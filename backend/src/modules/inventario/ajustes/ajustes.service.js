const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { aplicarMovimiento } = require('../../../shared/services/inventario.service');
const { obtenerSiguienteFolio } = require('../../../shared/services/secuencia.service');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');
const { parsePaginacion, parseOrden, respuestaPaginada } = require('../../../shared/paginacion');

const COLUMNAS_ORDENABLES = { folio: 'folio', motivo: 'motivo', creadoEn: 'creadoEn' };

// `paginacion` opcional, mismo criterio que Artículos/Clientes/Proveedores: sin `pagina`
// explícita devuelve el array completo (useDashboardData.js necesita la lista sin paginar
// para el feed de movimientos recientes), solo pagina cuando el caller la pide (AjustesPage).
async function listar({ empresaId, filtros, paginacion, ordenamiento }) {
  const where = { empresaId };
  if (filtros?.buscar) {
    where.OR = [
      { folio: { contains: filtros.buscar, mode: 'insensitive' } },
      { motivo: { contains: filtros.buscar, mode: 'insensitive' } },
    ];
  }

  if (!paginacion || paginacion.pagina === undefined) {
    return prisma.ajuste.findMany({ where, orderBy: { creadoEn: 'desc' }, take: 200 });
  }

  const paginado = parsePaginacion(paginacion);
  const orderBy = parseOrden(ordenamiento || {}, COLUMNAS_ORDENABLES, { creadoEn: 'desc' });

  const [datos, total] = await Promise.all([
    prisma.ajuste.findMany({ where, orderBy, skip: paginado.skip, take: paginado.take }),
    prisma.ajuste.count({ where }),
  ]);
  return respuestaPaginada(datos, total, paginado);
}

async function obtener({ empresaId, ajusteId }) {
  const ajuste = await prisma.ajuste.findFirst({ where: { id: ajusteId, empresaId }, include: { detalles: true } });
  if (!ajuste) throw new AppError(404, 'Ajuste no encontrado.');

  const articuloIds = [...new Set(ajuste.detalles.map((d) => d.articuloId))];
  const articulos = await prisma.articulo.findMany({
    where: { id: { in: articuloIds } },
    select: { id: true, nombre: true, sku: true },
  });
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  return {
    ...ajuste,
    detalles: ajuste.detalles.map((d) => ({ ...d, articulo: articuloPorId.get(d.articuloId) || null })),
  };
}

// Sin PATCH/DELETE: un ajuste ya aplicado es parte del Kardex y queda inmutable (§3.14),
// igual que la propia Auditoria.
async function crear({ empresaId, usuarioId, sucursalId, motivo, autorizadoPorId, detalles }) {
  const sucursal = await prisma.sucursal.findFirst({ where: { id: sucursalId, empresaId } });
  if (!sucursal) throw new AppError(400, 'La sucursal indicada no pertenece a esta empresa.');

  const articuloIds = detalles.map((d) => d.articuloId);
  const articulosValidos = await prisma.articulo.findMany({ where: { id: { in: articuloIds }, empresaId } });
  if (articulosValidos.length !== new Set(articuloIds).size) {
    throw new AppError(400, 'Algún artículo indicado no pertenece a esta empresa o está repetido.');
  }
  if (articulosValidos.some((a) => a.tipo === 'SERVICIO' || a.tipo === 'KIT')) {
    throw new AppError(400, 'Un artículo tipo Servicio o Kit no lleva inventario directo.');
  }

  if (autorizadoPorId) {
    const autorizador = await prisma.usuarioEmpresa.findUnique({
      where: { usuarioId_empresaId: { usuarioId: autorizadoPorId, empresaId } },
    });
    if (!autorizador) throw new AppError(400, 'El usuario autorizador indicado no pertenece a esta empresa.');
  }

  return prisma.$transaction(async (tx) => {
    const folio = await obtenerSiguienteFolio(tx, { empresaId, sucursalId, tipoDocumento: 'AJU' });

    const ajuste = await tx.ajuste.create({
      data: { empresaId, sucursalId, folio, motivo, usuarioId, autorizadoPorId },
    });

    await tx.ajusteDetalle.createMany({
      data: detalles.map((d) => ({ ajusteId: ajuste.id, articuloId: d.articuloId, cantidad: d.cantidad })),
    });

    for (const detalle of detalles) {
      await aplicarMovimiento(tx, {
        empresaId,
        sucursalId,
        articuloId: detalle.articuloId,
        tipo: detalle.cantidad > 0 ? 'AJUSTE_ENTRADA' : 'AJUSTE_SALIDA',
        cantidad: Math.abs(detalle.cantidad),
        referenciaTipo: 'Ajuste',
        referenciaId: ajuste.id,
        usuarioId,
      });
    }

    await registrarAuditoria(tx, {
      empresaId,
      sucursalId,
      usuarioEjecutorId: usuarioId,
      usuarioAutorizadorId: autorizadoPorId || null,
      accion: 'CREAR',
      entidad: 'Ajuste',
      entidadId: ajuste.id,
      folio,
      motivo,
      valoresDespues: toJson(detalles),
    });

    return { ...ajuste, detalles };
  });
}

module.exports = { listar, obtener, crear };
