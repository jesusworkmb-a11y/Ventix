const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { aplicarMovimiento } = require('../../../shared/services/inventario.service');
const { registrarMovimientoCaja } = require('../../../shared/services/caja.service');
const { obtenerSiguienteFolio } = require('../../../shared/services/secuencia.service');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');
const redondear = require('../../../shared/redondear');

// Devolucion no tiene empresaId propio — se valida pertenencia yendo a través de su Venta.
async function listar({ empresaId, filtros }) {
  const ventasEmpresa = await prisma.venta.findMany({
    where: { empresaId, ...(filtros.ventaId ? { id: filtros.ventaId } : {}) },
    select: { id: true },
  });
  const ventaIds = ventasEmpresa.map((v) => v.id);
  return prisma.devolucion.findMany({ where: { ventaId: { in: ventaIds } }, orderBy: { creadoEn: 'desc' }, take: 200 });
}

async function obtener({ empresaId, devolucionId }) {
  const devolucion = await prisma.devolucion.findUnique({ where: { id: devolucionId }, include: { detalles: true } });
  if (!devolucion) throw new AppError(404, 'Devolución no encontrada.');
  const venta = await prisma.venta.findFirst({ where: { id: devolucion.ventaId, empresaId } });
  if (!venta) throw new AppError(404, 'Devolución no encontrada.');

  const articuloIds = [...new Set(devolucion.detalles.map((d) => d.articuloId))];
  const articulos = await prisma.articulo.findMany({
    where: { id: { in: articuloIds } },
    select: { id: true, nombre: true, sku: true },
  });
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  return {
    ...devolucion,
    detalles: devolucion.detalles.map((d) => ({ ...d, articulo: articuloPorId.get(d.articuloId) || null })),
  };
}

// autorizadoPorId es obligatorio en el schema (no opcional como en Ajuste/MovimientoCaja) —
// se valida que pertenezca a la empresa, sin exigir que sea distinto de quien procesa la
// devolución (igual de permisivo que los demás casos de autorización del proyecto).
async function crear({ empresaId, usuarioId, ventaId, motivo, autorizadoPorId, sesionCajaId, detalles }) {
  const venta = await prisma.venta.findFirst({ where: { id: ventaId, empresaId }, include: { detalles: true } });
  if (!venta) throw new AppError(400, 'La venta indicada no pertenece a esta empresa.');
  if (venta.estado !== 'CONFIRMADA') {
    throw new AppError(400, 'Solo se pueden procesar devoluciones sobre ventas confirmadas.');
  }

  const autorizador = await prisma.usuarioEmpresa.findUnique({
    where: { usuarioId_empresaId: { usuarioId: autorizadoPorId, empresaId } },
  });
  if (!autorizador) throw new AppError(400, 'El usuario autorizador indicado no pertenece a esta empresa.');

  const detallePorArticulo = new Map(venta.detalles.map((d) => [d.articuloId, d]));

  let reembolso = 0;
  const lineas = [];
  for (const detalle of detalles) {
    const ventaDetalle = detallePorArticulo.get(detalle.articuloId);
    if (!ventaDetalle) throw new AppError(400, 'El artículo indicado no forma parte de esta venta.');

    const disponible = Number(ventaDetalle.cantidad) - Number(ventaDetalle.cantidadDevuelta);
    if (detalle.cantidad > disponible) {
      throw new AppError(
        400,
        `No se puede devolver más de lo vendido/no devuelto para ese artículo (disponible: ${disponible}).`,
      );
    }

    reembolso += detalle.cantidad * Number(ventaDetalle.precio) * (1 + Number(ventaDetalle.impuestoTasa));
    lineas.push({ ...detalle, ventaDetalleId: ventaDetalle.id });
  }
  reembolso = redondear(reembolso);

  if (reembolso > 0 && !sesionCajaId) {
    throw new AppError(400, 'Esta devolución implica un reembolso; indica una sesión de caja abierta para procesarlo.');
  }

  return prisma.$transaction(async (tx) => {
    const folio = await obtenerSiguienteFolio(tx, { empresaId, sucursalId: venta.sucursalId, tipoDocumento: 'DEV' });

    const devolucion = await tx.devolucion.create({
      data: { ventaId, folio, motivo, usuarioId, autorizadoPorId, reembolso },
    });

    await tx.devolucionDetalle.createMany({
      data: lineas.map((l) => ({
        devolucionId: devolucion.id,
        articuloId: l.articuloId,
        cantidad: l.cantidad,
        vuelveAStock: l.vuelveAStock,
      })),
    });

    for (const linea of lineas) {
      await tx.ventaDetalle.update({
        where: { id: linea.ventaDetalleId },
        data: { cantidadDevuelta: { increment: linea.cantidad } },
      });

      if (linea.vuelveAStock) {
        await aplicarMovimiento(tx, {
          empresaId,
          sucursalId: venta.sucursalId,
          articuloId: linea.articuloId,
          tipo: 'ENTRADA_DEVOLUCION',
          cantidad: linea.cantidad,
          referenciaTipo: 'Devolucion',
          referenciaId: devolucion.id,
          usuarioId,
        });
      }
    }

    if (reembolso > 0) {
      await registrarMovimientoCaja(tx, {
        empresaId,
        sesionCajaId,
        tipo: 'DEVOLUCION',
        monto: reembolso,
        referenciaTipo: 'Devolucion',
        referenciaId: devolucion.id,
        usuarioId,
        autorizadoPorId,
      });
    }

    await registrarAuditoria(tx, {
      empresaId,
      sucursalId: venta.sucursalId,
      usuarioEjecutorId: usuarioId,
      usuarioAutorizadorId: autorizadoPorId,
      accion: 'CREAR',
      entidad: 'Devolucion',
      entidadId: devolucion.id,
      folio,
      motivo,
      valoresDespues: toJson({ ventaId, reembolso, detalles: lineas }),
    });

    return { ...devolucion, detalles: lineas };
  });
}

module.exports = { listar, obtener, crear };
