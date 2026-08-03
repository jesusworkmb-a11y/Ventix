const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { aplicarMovimiento } = require('../../../shared/services/inventario.service');
const { obtenerSiguienteFolio } = require('../../../shared/services/secuencia.service');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');

async function listar({ empresaId }) {
  return prisma.transferencia.findMany({ where: { empresaId }, orderBy: { creadoEn: 'desc' }, take: 200 });
}

async function obtener({ empresaId, transferenciaId }) {
  const transferencia = await prisma.transferencia.findFirst({
    where: { id: transferenciaId, empresaId },
    include: { detalles: true },
  });
  if (!transferencia) throw new AppError(404, 'Transferencia no encontrada.');

  const articuloIds = [...new Set(transferencia.detalles.map((d) => d.articuloId))];
  const articulos = await prisma.articulo.findMany({
    where: { id: { in: articuloIds } },
    select: { id: true, nombre: true, sku: true },
  });
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  return {
    ...transferencia,
    detalles: transferencia.detalles.map((d) => ({ ...d, articulo: articuloPorId.get(d.articuloId) || null })),
  };
}

// Al crear, descuenta el origen de inmediato (TRANSFERENCIA_SALIDA) y queda EN_TRANSITO —
// el destino solo se abona cuando alguien la recibe explícitamente (recibir()).
async function crear({ empresaId, usuarioId, sucursalOrigenId, sucursalDestinoId, detalles }) {
  const [origen, destino] = await Promise.all([
    prisma.sucursal.findFirst({ where: { id: sucursalOrigenId, empresaId } }),
    prisma.sucursal.findFirst({ where: { id: sucursalDestinoId, empresaId } }),
  ]);
  if (!origen) throw new AppError(400, 'La sucursal de origen no pertenece a esta empresa.');
  if (!destino) throw new AppError(400, 'La sucursal de destino no pertenece a esta empresa.');

  const articuloIds = detalles.map((d) => d.articuloId);
  const articulosValidos = await prisma.articulo.findMany({ where: { id: { in: articuloIds }, empresaId } });
  if (articulosValidos.length !== new Set(articuloIds).size) {
    throw new AppError(400, 'Algún artículo indicado no pertenece a esta empresa o está repetido.');
  }

  return prisma.$transaction(async (tx) => {
    // TRA vive a nivel empresa (sucursalId: null) — una transferencia no pertenece a una
    // sola sucursal, mismo criterio usado al sembrar las Secuencias en el registro de empresa.
    const folio = await obtenerSiguienteFolio(tx, { empresaId, sucursalId: null, tipoDocumento: 'TRA' });

    const transferencia = await tx.transferencia.create({
      data: { empresaId, sucursalOrigenId, sucursalDestinoId, folio, usuarioId },
    });

    await tx.transferenciaDetalle.createMany({
      data: detalles.map((d) => ({
        transferenciaId: transferencia.id,
        articuloId: d.articuloId,
        cantidad: d.cantidad,
      })),
    });

    for (const detalle of detalles) {
      await aplicarMovimiento(tx, {
        empresaId,
        sucursalId: sucursalOrigenId,
        articuloId: detalle.articuloId,
        tipo: 'TRANSFERENCIA_SALIDA',
        cantidad: detalle.cantidad,
        referenciaTipo: 'Transferencia',
        referenciaId: transferencia.id,
        usuarioId,
      });
    }

    await registrarAuditoria(tx, {
      empresaId,
      sucursalId: sucursalOrigenId,
      usuarioEjecutorId: usuarioId,
      accion: 'CREAR',
      entidad: 'Transferencia',
      entidadId: transferencia.id,
      folio,
      valoresDespues: toJson(detalles),
    });

    return { ...transferencia, detalles };
  });
}

async function recibir({ empresaId, usuarioId, transferenciaId }) {
  const transferencia = await prisma.transferencia.findFirst({
    where: { id: transferenciaId, empresaId },
    include: { detalles: true },
  });
  if (!transferencia) throw new AppError(404, 'Transferencia no encontrada.');
  if (transferencia.estado !== 'EN_TRANSITO') {
    throw new AppError(400, 'Solo se pueden recibir transferencias en tránsito.');
  }

  return prisma.$transaction(async (tx) => {
    // El check de "está en tránsito" de arriba no es atómico con el resto: dos recibir()
    // casi simultáneos pasaban ambos el check y aplicaban el ingreso al destino dos veces
    // (verificado en vivo en QA de Inventario: 5 recibir() concurrentes, destino +25 en vez
    // de +5). Se reclama la transferencia con un UPDATE...WHERE estado='EN_TRANSITO' antes de
    // aplicar los movimientos, mismo patrón que la conversión de cotización en Ventas.
    const reclamada = await tx.transferencia.updateMany({
      where: { id: transferenciaId, estado: 'EN_TRANSITO' },
      data: { estado: 'RECIBIDA' },
    });
    if (reclamada.count === 0) {
      throw new AppError(400, 'Solo se pueden recibir transferencias en tránsito.');
    }

    for (const detalle of transferencia.detalles) {
      await aplicarMovimiento(tx, {
        empresaId,
        sucursalId: transferencia.sucursalDestinoId,
        articuloId: detalle.articuloId,
        tipo: 'TRANSFERENCIA_ENTRADA',
        cantidad: detalle.cantidad,
        referenciaTipo: 'Transferencia',
        referenciaId: transferencia.id,
        usuarioId,
      });
    }

    const actualizada = await tx.transferencia.findUnique({ where: { id: transferenciaId } });

    await registrarAuditoria(tx, {
      empresaId,
      sucursalId: transferencia.sucursalDestinoId,
      usuarioEjecutorId: usuarioId,
      accion: 'ACTUALIZAR',
      entidad: 'Transferencia',
      entidadId: transferenciaId,
      valoresAntes: toJson({ estado: 'EN_TRANSITO' }),
      valoresDespues: toJson({ estado: 'RECIBIDA' }),
    });

    return actualizada;
  });
}

module.exports = { listar, obtener, crear, recibir };
