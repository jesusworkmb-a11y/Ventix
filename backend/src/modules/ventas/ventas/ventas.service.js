const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { aplicarMovimiento } = require('../../../shared/services/inventario.service');
const { registrarMovimientoCaja } = require('../../../shared/services/caja.service');
const { obtenerSiguienteFolio } = require('../../../shared/services/secuencia.service');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const { usuarioTienePermiso } = require('../../../shared/services/permisos.service');
const toJson = require('../../../shared/toJson');
const redondear = require('../../../shared/redondear');
const { parsePaginacion, parseOrden, respuestaPaginada } = require('../../../shared/paginacion');

const COLUMNAS_ORDENABLES = {
  folio: 'folio',
  cliente: 'cliente.nombre',
  total: 'total',
  estado: 'estado',
  creadoEn: 'creadoEn',
};

// Precio "de catálogo" efectivo para un cliente: el de su lista de precio asignada
// (PrecioArticulo) si tiene una y el artículo tiene un precio ahí definido; si no,
// el precio base del artículo. Reusado por cotizaciones.service.js (mismo módulo, MOD-008)
// para que una cotización y la venta en la que se convierte partan del mismo precio base.
async function resolverPreciosCatalogo({ articuloIds, listaPrecioId }) {
  const precios = new Map();
  if (listaPrecioId) {
    const porLista = await prisma.precioArticulo.findMany({
      where: { articuloId: { in: articuloIds }, listaPrecioId },
    });
    for (const p of porLista) precios.set(p.articuloId, Number(p.precio));
  }
  return precios;
}

async function listar({ empresaId, filtros, paginacion, ordenamiento }) {
  const where = { empresaId };
  if (filtros.clienteId) where.clienteId = filtros.clienteId;
  if (filtros.sucursalId) where.sucursalId = filtros.sucursalId;
  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.desde || filtros.hasta) {
    where.creadoEn = {};
    if (filtros.desde) where.creadoEn.gte = new Date(filtros.desde);
    if (filtros.hasta) where.creadoEn.lte = new Date(filtros.hasta);
  }
  if (filtros.buscar) {
    where.OR = [
      { folio: { contains: filtros.buscar, mode: 'insensitive' } },
      { cliente: { nombre: { contains: filtros.buscar, mode: 'insensitive' } } },
    ];
  }

  const paginado = parsePaginacion(paginacion);
  const orderBy = parseOrden(ordenamiento || {}, COLUMNAS_ORDENABLES, { creadoEn: 'desc' });

  const [datos, total] = await Promise.all([
    prisma.venta.findMany({
      where,
      include: { cliente: true, sucursal: true },
      orderBy,
      skip: paginado.skip,
      take: paginado.take,
    }),
    prisma.venta.count({ where }),
  ]);

  return respuestaPaginada(datos, total, paginado);
}

async function obtener({ empresaId, ventaId }) {
  const venta = await prisma.venta.findFirst({
    where: { id: ventaId, empresaId },
    include: { cliente: true, sucursal: true, detalles: true, pagos: true },
  });
  if (!venta) throw new AppError(404, 'Venta no encontrada.');

  const articuloIds = [...new Set(venta.detalles.map((d) => d.articuloId))];
  const articulos = await prisma.articulo.findMany({
    where: { id: { in: articuloIds } },
    select: { id: true, nombre: true, sku: true },
  });
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  return {
    ...venta,
    detalles: venta.detalles.map((d) => ({ ...d, articulo: articuloPorId.get(d.articuloId) || null })),
  };
}

// Precio/tasa de impuesto se congelan por línea (§20.9, §3.14). Un precio manual distinto al
// de catálogo exige permiso: más bajo = venta.aplicar_descuento, más alto = venta.modificar_precio
// (el schema no tiene un campo "descuento" separado — un descuento ES un precio de línea menor).
async function crear({ empresaId, usuarioId, rolId, sucursalId, clienteId, sesionCajaId, detalles, pagos }) {
  const sucursal = await prisma.sucursal.findFirst({ where: { id: sucursalId, empresaId } });
  if (!sucursal) throw new AppError(400, 'La sucursal indicada no pertenece a esta empresa.');

  const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, empresaId } });
  if (!cliente) throw new AppError(400, 'El cliente indicado no pertenece a esta empresa.');
  if (!cliente.activo) throw new AppError(400, 'El cliente está inactivo y no se le pueden registrar ventas.');

  const articuloIds = detalles.map((d) => d.articuloId);
  const articulos = await prisma.articulo.findMany({
    where: { id: { in: articuloIds }, empresaId },
    include: { impuesto: true },
  });
  if (articulos.length !== new Set(articuloIds).size) {
    throw new AppError(400, 'Algún artículo indicado no pertenece a esta empresa o está repetido.');
  }
  if (articulos.some((a) => !a.activo)) {
    throw new AppError(400, 'Algún artículo indicado está descontinuado y no se puede vender.');
  }
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));
  const preciosLista = await resolverPreciosCatalogo({ articuloIds, listaPrecioId: cliente.listaPrecioId });

  const lineas = [];
  for (const detalle of detalles) {
    const articulo = articuloPorId.get(detalle.articuloId);
    const precioCatalogo = preciosLista.has(detalle.articuloId)
      ? preciosLista.get(detalle.articuloId)
      : Number(articulo.precio);
    let precio = precioCatalogo;

    if (detalle.precio !== undefined && detalle.precio !== precioCatalogo) {
      precio = detalle.precio;
      const clave = precio < precioCatalogo ? 'venta.aplicar_descuento' : 'venta.modificar_precio';
      const tienePermiso = await usuarioTienePermiso({ usuarioId, rolId, clave });
      if (!tienePermiso) {
        const accion = precio < precioCatalogo ? 'aplicar descuentos' : 'modificar el precio';
        throw new AppError(403, `No tienes permiso para ${accion} en esta línea.`);
      }
    }

    const impuestoTasa = articulo.impuesto ? Number(articulo.impuesto.tasa) : 0;
    lineas.push({ articuloId: detalle.articuloId, cantidad: detalle.cantidad, precio, impuestoTasa });
  }

  const subtotal = redondear(lineas.reduce((acc, l) => acc + l.cantidad * l.precio, 0));
  const impuestos = redondear(lineas.reduce((acc, l) => acc + l.cantidad * l.precio * l.impuestoTasa, 0));
  const total = redondear(subtotal + impuestos);

  const sumaPagos = redondear(pagos.reduce((acc, p) => acc + p.monto, 0));
  if (Math.abs(sumaPagos - total) > 0.01) {
    throw new AppError(
      400,
      `La suma de los pagos (${sumaPagos.toFixed(2)}) no coincide con el total (${total.toFixed(2)}).`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const folio = await obtenerSiguienteFolio(tx, { empresaId, sucursalId, tipoDocumento: 'VTA' });

    const venta = await tx.venta.create({
      data: { empresaId, sucursalId, clienteId, usuarioId, sesionCajaId, folio, subtotal, impuestos, total },
    });

    await tx.ventaDetalle.createMany({
      data: lineas.map((l) => ({
        ventaId: venta.id,
        articuloId: l.articuloId,
        cantidad: l.cantidad,
        precio: l.precio,
        impuestoTasa: l.impuestoTasa,
      })),
    });

    await tx.pago.createMany({
      data: pagos.map((p) => ({ ventaId: venta.id, metodo: p.metodo, monto: p.monto })),
    });

    for (const linea of lineas) {
      await aplicarMovimiento(tx, {
        empresaId,
        sucursalId,
        articuloId: linea.articuloId,
        tipo: 'SALIDA_VENTA',
        cantidad: linea.cantidad,
        referenciaTipo: 'Venta',
        referenciaId: venta.id,
        usuarioId,
      });
    }

    await registrarMovimientoCaja(tx, {
      empresaId,
      sesionCajaId,
      sucursalId,
      tipo: 'VENTA',
      monto: total,
      referenciaTipo: 'Venta',
      referenciaId: venta.id,
      usuarioId,
    });

    await registrarAuditoria(tx, {
      empresaId,
      sucursalId,
      usuarioEjecutorId: usuarioId,
      accion: 'CREAR',
      entidad: 'Venta',
      entidadId: venta.id,
      folio,
      valoresDespues: toJson({ clienteId, subtotal, impuestos, total, detalles }),
    });

    return { ...venta, detalles: lineas, pagos };
  });
}

// No revierte el movimiento de caja (mismo corte deliberado que "cancelar no revierte el
// último costo" en Compras, Fase 5) — si hace falta ajustar el efectivo, es un RETIRO manual.
async function cancelar({ empresaId, usuarioId, ventaId }) {
  const venta = await prisma.venta.findFirst({ where: { id: ventaId, empresaId }, include: { detalles: true } });
  if (!venta) throw new AppError(404, 'Venta no encontrada.');
  if (venta.estado !== 'CONFIRMADA') throw new AppError(400, 'Solo se pueden cancelar ventas confirmadas.');

  return prisma.$transaction(async (tx) => {
    for (const detalle of venta.detalles) {
      await aplicarMovimiento(tx, {
        empresaId,
        sucursalId: venta.sucursalId,
        articuloId: detalle.articuloId,
        tipo: 'CANCELACION_VENTA',
        cantidad: Number(detalle.cantidad),
        referenciaTipo: 'Venta',
        referenciaId: venta.id,
        usuarioId,
      });
    }

    const actualizada = await tx.venta.update({ where: { id: ventaId }, data: { estado: 'CANCELADA' } });

    await registrarAuditoria(tx, {
      empresaId,
      sucursalId: venta.sucursalId,
      usuarioEjecutorId: usuarioId,
      accion: 'ACTUALIZAR',
      entidad: 'Venta',
      entidadId: ventaId,
      valoresAntes: toJson({ estado: 'CONFIRMADA' }),
      valoresDespues: toJson({ estado: 'CANCELADA' }),
    });

    return actualizada;
  });
}

module.exports = { listar, obtener, crear, cancelar, resolverPreciosCatalogo };
