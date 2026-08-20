const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { aplicarMovimiento } = require('../../../shared/services/inventario.service');
const { registrarMovimientoCaja } = require('../../../shared/services/caja.service');
const { obtenerSiguienteFolio } = require('../../../shared/services/secuencia.service');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');
const redondear = require('../../../shared/redondear');
const { aDecimalString } = require('../../../shared/decimal');

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
  // Mismo gap que en ventas.cancelar (verificado en vivo, tercera ronda de QA 2026-08-18): sin
  // este check, una devolución quedaba registrada (reembolso + reversión de stock) sobre una
  // venta cuya Factura seguía TIMBRADA ante el SAT con el monto/cantidad original, sin ningún
  // reflejo del reembolso en el CFDI.
  if (venta.facturaId) {
    throw new AppError(400, 'Esta venta ya fue facturada. Cancelá primero la factura (Facturación) antes de procesar una devolución.');
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

    // El reembolso debe reflejar lo que el cliente realmente pagó, no el precio de lista: si la
    // línea tuvo un descuento/promoción (catalogo.descuentos o manual), descuentoMonto es el
    // total de la línea completa, así que se prorratea por unidad antes de calcular el
    // reembolso — sin esto, devolver una línea con descuento reembolsaba de más (verificado en
    // vivo: venta de 5 unidades a $10 con 20% de descuento, total pagado $40, la devolución
    // completa reembolsaba $50 en vez de $40).
    const cantidadOriginal = Number(ventaDetalle.cantidad);
    const descuentoPorUnidad = cantidadOriginal > 0 ? Number(ventaDetalle.descuentoMonto) / cantidadOriginal : 0;
    const precioNetoUnitario = Number(ventaDetalle.precio) - descuentoPorUnidad;
    reembolso += detalle.cantidad * precioNetoUnitario * (1 + Number(ventaDetalle.impuestoTasa));
    lineas.push({ ...detalle, ventaDetalleId: ventaDetalle.id });
  }
  reembolso = redondear(reembolso);

  if (reembolso > 0 && !sesionCajaId) {
    throw new AppError(400, 'Esta devolución implica un reembolso; indica una sesión de caja abierta para procesarlo.');
  }

  return prisma.$transaction(async (tx) => {
    // Los checks de venta.estado/venta.facturaId de arriba no son atómicos con esta transacción --
    // sin releerlos con FOR UPDATE acá, un cancelar() o crearDesdeVenta() concurrente (que sí
    // reclaman la venta atómicamente, ver ventas.service.js#cancelar y facturas.service.js) podía
    // cancelar/facturar la venta mientras esta devolución seguía en curso, dejando un
    // reembolso/reversión de stock registrado sobre una venta ya cancelada o facturada. Mismo
    // patrón FOR UPDATE que ya se usa más abajo para ventaDetalle. (Encontrado en la ronda de QA
    // pre-lanzamiento: el candado original solo releía facturaId, no estado -- una devolución
    // concurrente con una cancelación pasaba igual porque facturaId seguía null.)
    const [ventaLock] = await tx.$queryRaw`SELECT estado, factura_id AS "facturaId" FROM ventas WHERE id = ${ventaId} FOR UPDATE`;
    if (ventaLock.estado !== 'CONFIRMADA') {
      throw new AppError(400, 'Solo se pueden procesar devoluciones sobre ventas confirmadas.');
    }
    if (ventaLock.facturaId) {
      throw new AppError(400, 'Esta venta ya fue facturada. Cancelá primero la factura (Facturación) antes de procesar una devolución.');
    }

    const folio = await obtenerSiguienteFolio(tx, { empresaId, sucursalId: venta.sucursalId, tipoDocumento: 'DEV' });

    const devolucion = await tx.devolucion.create({
      data: { ventaId, folio, motivo, usuarioId, autorizadoPorId, reembolso: aDecimalString(reembolso) },
    });

    await tx.devolucionDetalle.createMany({
      data: lineas.map((l) => ({
        devolucionId: devolucion.id,
        articuloId: l.articuloId,
        // aDecimalString(): mismo motivo que ventas.service.js/cotizaciones.service.js --
        // DevolucionDetalle.cantidad es Decimal (ronda de QA pre-lanzamiento).
        cantidad: aDecimalString(l.cantidad),
        vuelveAStock: l.vuelveAStock,
      })),
    });

    for (const linea of lineas) {
      // El check de "disponible" de arriba se calculó con datos leídos ANTES de esta
      // transacción, así que dos devoluciones concurrentes sobre la misma línea podían pasar
      // ambas el check y sobre-devolver: verificado en vivo con 3 devoluciones concurrentes
      // pidiendo las mismas 5 unidades vendidas — las 3 tuvieron éxito, $150 reembolsados y +15
      // de stock sobre una venta de 5 unidades / $50. Se relee la línea con FOR UPDATE (mismo
      // patrón que sesiones_caja en caja.service.js) para bloquearla y revalidar contra el valor
      // fresco antes de incrementar cantidadDevuelta.
      const [ventaDetalleActual] = await tx.$queryRaw`
        SELECT cantidad, cantidad_devuelta AS "cantidadDevuelta"
        FROM ventas_detalle WHERE id = ${linea.ventaDetalleId} FOR UPDATE
      `;
      const disponibleAhora = Number(ventaDetalleActual.cantidad) - Number(ventaDetalleActual.cantidadDevuelta);
      if (linea.cantidad > disponibleAhora) {
        throw new AppError(
          400,
          `No se puede devolver más de lo vendido/no devuelto para ese artículo (disponible: ${disponibleAhora}).`,
        );
      }

      await tx.ventaDetalle.update({
        where: { id: linea.ventaDetalleId },
        data: { cantidadDevuelta: { increment: aDecimalString(linea.cantidad) } },
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
        sucursalId: venta.sucursalId,
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
