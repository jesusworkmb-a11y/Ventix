const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { aplicarMovimiento } = require('../../../shared/services/inventario.service');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');
const { parsePaginacion, parseOrden, respuestaPaginada } = require('../../../shared/paginacion');

const COLUMNAS_ORDENABLES = { estado: 'estado', creadoEn: 'creadoEn' };

// Único consumidor (ConteosPage) — no necesita modo dual. ConteoFisico no tiene ningún campo
// de texto libre (ni folio, a diferencia de Ajustes/Transferencias) así que el filtro real es
// por sucursalId exacto en vez de un `buscar` de texto.
async function listar({ empresaId, filtros, paginacion, ordenamiento }) {
  const where = { empresaId };
  if (filtros?.sucursalId) where.sucursalId = filtros.sucursalId;

  const paginado = parsePaginacion(paginacion);
  const orderBy = parseOrden(ordenamiento || {}, COLUMNAS_ORDENABLES, { creadoEn: 'desc' });

  const [datos, total] = await Promise.all([
    prisma.conteoFisico.findMany({ where, orderBy, skip: paginado.skip, take: paginado.take }),
    prisma.conteoFisico.count({ where }),
  ]);
  return respuestaPaginada(datos, total, paginado);
}

async function obtener({ empresaId, conteoId }) {
  const conteo = await prisma.conteoFisico.findFirst({
    where: { id: conteoId, empresaId },
    include: { detalles: true },
  });
  if (!conteo) throw new AppError(404, 'Conteo físico no encontrado.');

  const articuloIds = [...new Set(conteo.detalles.map((d) => d.articuloId))];
  const articulos = await prisma.articulo.findMany({
    where: { id: { in: articuloIds } },
    select: { id: true, nombre: true, sku: true },
  });
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  return {
    ...conteo,
    detalles: conteo.detalles.map((d) => ({ ...d, articulo: articuloPorId.get(d.articuloId) || null })),
  };
}

async function crear({ empresaId, usuarioId, sucursalId }) {
  const sucursal = await prisma.sucursal.findFirst({ where: { id: sucursalId, empresaId } });
  if (!sucursal) throw new AppError(400, 'La sucursal indicada no pertenece a esta empresa.');

  return prisma.$transaction(async (tx) => {
    const conteo = await tx.conteoFisico.create({ data: { empresaId, sucursalId, usuarioId } });
    await registrarAuditoria(tx, {
      empresaId,
      sucursalId,
      usuarioEjecutorId: usuarioId,
      accion: 'CREAR',
      entidad: 'ConteoFisico',
      entidadId: conteo.id,
    });
    return conteo;
  });
}

// Reemplaza el set completo de líneas capturadas. cantidadSistema se congela aquí (existencia
// vigente al momento de capturar), no al autorizar — el conteo debe reflejar lo que había al
// empezar a contar, no lo que cambió mientras tanto por otras operaciones.
async function reemplazarDetalles({ empresaId, usuarioEjecutorId, conteoId, detalles }) {
  const conteo = await prisma.conteoFisico.findFirst({ where: { id: conteoId, empresaId } });
  if (!conteo) throw new AppError(404, 'Conteo físico no encontrado.');
  if (conteo.estado !== 'CAPTURA') {
    throw new AppError(400, 'Solo se pueden editar las líneas mientras el conteo está en captura.');
  }

  const articuloIds = detalles.map((d) => d.articuloId);
  const articulosValidos = await prisma.articulo.findMany({ where: { id: { in: articuloIds }, empresaId } });
  if (articulosValidos.length !== new Set(articuloIds).size) {
    throw new AppError(400, 'Algún artículo indicado no pertenece a esta empresa o está repetido.');
  }

  const existencias = await prisma.existencia.findMany({
    where: { sucursalId: conteo.sucursalId, articuloId: { in: articuloIds } },
  });
  const existenciaPorArticulo = new Map(existencias.map((e) => [e.articuloId, Number(e.cantidad)]));

  return prisma.$transaction(async (tx) => {
    await tx.conteoDetalle.deleteMany({ where: { conteoId } });
    if (detalles.length) {
      await tx.conteoDetalle.createMany({
        data: detalles.map((d) => ({
          conteoId,
          articuloId: d.articuloId,
          cantidadSistema: existenciaPorArticulo.get(d.articuloId) || 0,
          cantidadFisica: d.cantidadFisica,
        })),
      });
    }
    await registrarAuditoria(tx, {
      empresaId,
      sucursalId: conteo.sucursalId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'ConteoFisico',
      entidadId: conteoId,
      valoresDespues: toJson(detalles),
    });
    return detalles;
  });
}

const TRANSICIONES_VALIDAS = { CAPTURA: 'REVISION', REVISION: 'AUTORIZADO' };

// Al llegar a AUTORIZADO aplica la diferencia (cantidadFisica - cantidadSistema) de cada línea
// como un ajuste de Kardex — no existe un tipo de movimiento dedicado a conteos, el schema
// reusa AJUSTE_ENTRADA/AJUSTE_SALIDA. Transición de un solo sentido, sin retroceder.
async function cambiarEstado({ empresaId, usuarioEjecutorId, conteoId, estado }) {
  const conteo = await prisma.conteoFisico.findFirst({
    where: { id: conteoId, empresaId },
    include: { detalles: true },
  });
  if (!conteo) throw new AppError(404, 'Conteo físico no encontrado.');

  if (TRANSICIONES_VALIDAS[conteo.estado] !== estado) {
    throw new AppError(400, `No se puede pasar de ${conteo.estado} a ${estado}.`);
  }
  if (conteo.detalles.length === 0) {
    throw new AppError(400, 'El conteo no tiene líneas capturadas.');
  }

  return prisma.$transaction(async (tx) => {
    // El check de transición de arriba no es atómico con el resto: dos cambiarEstado()
    // casi simultáneos hacia AUTORIZADO pasaban ambos el check (leído antes de que ninguno
    // commiteara) y aplicaban el ajuste de kardex dos veces sobre el mismo conteo (mismo
    // patrón que el doble-recibir de Transferencias). Se reclama la transición con un
    // UPDATE...WHERE estado=<el estado leído> antes de aplicar los movimientos.
    const reclamado = await tx.conteoFisico.updateMany({
      where: { id: conteoId, estado: conteo.estado },
      data: { estado },
    });
    if (reclamado.count === 0) {
      throw new AppError(400, `No se puede pasar de ${conteo.estado} a ${estado}.`);
    }

    if (estado === 'AUTORIZADO') {
      for (const detalle of conteo.detalles) {
        const diferencia = Number(detalle.cantidadFisica) - Number(detalle.cantidadSistema);
        if (diferencia === 0) continue;
        await aplicarMovimiento(tx, {
          empresaId,
          sucursalId: conteo.sucursalId,
          articuloId: detalle.articuloId,
          tipo: diferencia > 0 ? 'AJUSTE_ENTRADA' : 'AJUSTE_SALIDA',
          cantidad: Math.abs(diferencia),
          referenciaTipo: 'ConteoFisico',
          referenciaId: conteo.id,
          usuarioId: usuarioEjecutorId,
        });
      }
    }

    const actualizado = await tx.conteoFisico.findUnique({ where: { id: conteoId } });

    await registrarAuditoria(tx, {
      empresaId,
      sucursalId: conteo.sucursalId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'ConteoFisico',
      entidadId: conteoId,
      valoresAntes: toJson({ estado: conteo.estado }),
      valoresDespues: toJson({ estado }),
    });

    return actualizado;
  });
}

module.exports = { listar, obtener, crear, reemplazarDetalles, cambiarEstado };
