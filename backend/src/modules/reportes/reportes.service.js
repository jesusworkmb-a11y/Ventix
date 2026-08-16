const prisma = require('../../config/db');
const redondear = require('../../shared/redondear');
const { registrarAuditoria } = require('../../shared/services/auditoria.service');
const { enviarCorreoConAdjunto } = require('../../shared/services/correo.service');
const toJson = require('../../shared/toJson');

async function reporteVentas({
  empresaId, sucursalId, desde, hasta, usuarioId, clienteId,
}) {
  const where = { empresaId, estado: 'CONFIRMADA' };
  if (sucursalId) where.sucursalId = sucursalId;
  if (usuarioId) where.usuarioId = usuarioId;
  if (clienteId) where.clienteId = clienteId;
  if (desde || hasta) {
    where.creadoEn = {};
    if (desde) where.creadoEn.gte = new Date(desde);
    if (hasta) where.creadoEn.lte = new Date(hasta);
  }

  const [resumen, ventas] = await Promise.all([
    prisma.venta.aggregate({
      where,
      _sum: { subtotal: true, impuestos: true, total: true },
      _count: { _all: true },
      _avg: { total: true },
    }),
    prisma.venta.findMany({ where, select: { id: true } }),
  ]);

  const ventaIds = ventas.map((v) => v.id);
  // Una devolución no cambia venta.estado ni sus totales guardados (queda CONFIRMADA con el
  // monto original) -- sin esto, "total" sobreestima el ingreso neto en cuanto hay una
  // devolución. Se suman los reembolsos de las devoluciones de estas mismas ventas (sin
  // importar cuándo se procesó la devolución) para exponer también la cifra neta.
  const [pagosPorMetodo, devolucionesAgg] = await Promise.all([
    ventaIds.length
      ? prisma.pago.groupBy({ by: ['metodo'], where: { ventaId: { in: ventaIds } }, _sum: { monto: true } })
      : [],
    ventaIds.length
      ? prisma.devolucion.aggregate({ where: { ventaId: { in: ventaIds } }, _sum: { reembolso: true } })
      : { _sum: { reembolso: null } },
  ]);

  const total = Number(resumen._sum.total || 0);
  const totalDevoluciones = Number(devolucionesAgg._sum.reembolso || 0);

  return {
    numeroVentas: resumen._count._all,
    subtotal: resumen._sum.subtotal || 0,
    impuestos: resumen._sum.impuestos || 0,
    total: resumen._sum.total || 0,
    totalDevoluciones,
    totalNeto: redondear(total - totalDevoluciones),
    ticketPromedio: resumen._avg.total || 0,
    porMetodoPago: pagosPorMetodo.map((p) => ({ metodo: p.metodo, monto: p._sum.monto })),
  };
}

// VentaDetalle no permite sumar cantidad × precio con groupBy de Prisma (solo suma columnas,
// no productos) — se traen las filas y se reduce en JS, escala pensada para una PyME.
async function reporteArticulosMasVendidos({
  empresaId, sucursalId, desde, hasta, limite = 10, usuarioId, clienteId, categoriaId,
}) {
  const whereVenta = { empresaId, estado: 'CONFIRMADA' };
  if (sucursalId) whereVenta.sucursalId = sucursalId;
  if (usuarioId) whereVenta.usuarioId = usuarioId;
  if (clienteId) whereVenta.clienteId = clienteId;
  if (desde || hasta) {
    whereVenta.creadoEn = {};
    if (desde) whereVenta.creadoEn.gte = new Date(desde);
    if (hasta) whereVenta.creadoEn.lte = new Date(hasta);
  }

  const ventas = await prisma.venta.findMany({ where: whereVenta, select: { id: true } });
  const ventaIds = ventas.map((v) => v.id);
  if (!ventaIds.length) return [];

  const detalles = await prisma.ventaDetalle.findMany({
    where: { ventaId: { in: ventaIds } },
    select: { articuloId: true, cantidad: true, precio: true, cantidadDevuelta: true, descuentoMonto: true },
  });

  // Se descuenta lo devuelto de cada línea -- si no, un artículo devuelto por completo seguiría
  // apareciendo como "vendido" aquí (mismo hueco que en reporteVentas#total). También se
  // prorratea descuentoMonto por unidad (mismo criterio que el reembolso de devoluciones.service.js)
  // -- sin esto, "monto" mostraba el precio de lista en vez de lo que el cliente realmente pagó
  // cuando la línea tuvo un descuento/promoción de catálogo.
  const acumulado = new Map();
  for (const d of detalles) {
    const cantidadOriginal = Number(d.cantidad);
    const cantidadNeta = cantidadOriginal - Number(d.cantidadDevuelta);
    const descuentoPorUnidad = cantidadOriginal > 0 ? Number(d.descuentoMonto) / cantidadOriginal : 0;
    const precioNetoUnitario = Number(d.precio) - descuentoPorUnidad;
    const actual = acumulado.get(d.articuloId) || { cantidad: 0, monto: 0 };
    actual.cantidad += cantidadNeta;
    actual.monto += cantidadNeta * precioNetoUnitario;
    acumulado.set(d.articuloId, actual);
  }

  const articuloIds = [...acumulado.keys()];
  const articulos = await prisma.articulo.findMany({
    where: { id: { in: articuloIds } },
    select: {
      id: true, nombre: true, sku: true, categoriaId: true,
    },
  });
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  let filas = [...acumulado.entries()]
    .map(([articuloId, datos]) => ({ articulo: articuloPorId.get(articuloId) || null, ...datos }));
  // Filtrado en JS igual que el resto de esta función (comentario de arriba): el volumen de
  // artículos distintos vendidos en un rango es chico para una PyME, no justifica una segunda
  // consulta a la DB solo para acotar por categoría.
  if (categoriaId) {
    filas = filas.filter((f) => f.articulo?.categoriaId === categoriaId);
  }

  return filas
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, limite);
}

async function reporteInventarioValorizado({ empresaId, sucursalId }) {
  const where = { empresaId };
  if (sucursalId) where.sucursalId = sucursalId;

  const existencias = await prisma.existencia.findMany({
    where,
    include: {
      articulo: { select: { id: true, nombre: true, sku: true, costo: true, stockMinimo: true } },
      sucursal: { select: { id: true, nombre: true } },
    },
  });

  let valorTotal = 0;
  const porSucursal = new Map();
  const stockBajo = [];

  for (const e of existencias) {
    const valor = Number(e.cantidad) * Number(e.articulo.costo);
    valorTotal += valor;

    const actual = porSucursal.get(e.sucursalId) || { sucursal: e.sucursal, valor: 0 };
    actual.valor += valor;
    porSucursal.set(e.sucursalId, actual);

    if (e.articulo.stockMinimo !== null && Number(e.cantidad) <= Number(e.articulo.stockMinimo)) {
      stockBajo.push({
        articulo: e.articulo,
        sucursal: e.sucursal,
        cantidad: e.cantidad,
        stockMinimo: e.articulo.stockMinimo,
      });
    }
  }

  return { valorTotal, porSucursal: [...porSucursal.values()], stockBajo };
}

async function reporteCompras({ empresaId, sucursalId, desde, hasta }) {
  const where = { empresaId, estado: 'CONFIRMADA' };
  if (sucursalId) where.sucursalId = sucursalId;
  if (desde || hasta) {
    where.creadoEn = {};
    if (desde) where.creadoEn.gte = new Date(desde);
    if (hasta) where.creadoEn.lte = new Date(hasta);
  }

  const compras = await prisma.compra.findMany({
    where,
    include: { proveedor: { select: { id: true, nombre: true } } },
  });

  const porProveedor = new Map();
  let total = 0;
  for (const c of compras) {
    total += Number(c.total);
    const actual = porProveedor.get(c.proveedorId) || { proveedor: c.proveedor, total: 0, numeroCompras: 0 };
    actual.total += Number(c.total);
    actual.numeroCompras += 1;
    porProveedor.set(c.proveedorId, actual);
  }

  return { total, numeroCompras: compras.length, porProveedor: [...porProveedor.values()] };
}

// SesionCaja no tiene empresaId propio — se acota vía las Caja de la empresa (mismo patrón
// que Fase 6/7).
async function reporteCaja({ empresaId, cajaId, desde, hasta }) {
  const cajasEmpresa = await prisma.caja.findMany({
    where: { empresaId, ...(cajaId ? { id: cajaId } : {}) },
    select: { id: true, nombre: true },
  });
  const cajaIds = cajasEmpresa.map((c) => c.id);
  const cajaPorId = new Map(cajasEmpresa.map((c) => [c.id, c]));

  const where = { cajaId: { in: cajaIds }, cerradaEn: { not: null } };
  if (desde) where.cerradaEn.gte = new Date(desde);
  if (hasta) where.cerradaEn.lte = new Date(hasta);

  const sesiones = await prisma.sesionCaja.findMany({ where, orderBy: { cerradaEn: 'desc' }, take: 200 });
  const totalDiferencias = sesiones.reduce((acc, s) => acc + Number(s.diferencia || 0), 0);

  return {
    sesiones: sesiones.map((s) => ({ ...s, caja: cajaPorId.get(s.cajaId) || null })),
    totalDiferencias,
  };
}

// A diferencia de cotizaciones/compras/ventas, un reporte no es una fila persistida — no hay
// nada que buscar por ID. El CSV ya viene armado desde el frontend (mismos filas/columnas que
// la tabla en pantalla, ver ReportesPage.jsx), acá solo se relaya por correo y se audita.
async function enviar({
  empresaId, usuarioId, destinatario, asunto, mensaje, adjuntoBase64, nombreArchivo,
}) {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
  const asuntoFinal = asunto || `Reporte — ${empresa?.nombreComercial || 'BOX POS'}`;

  await enviarCorreoConAdjunto({
    destinatario,
    asunto: asuntoFinal,
    mensaje,
    adjunto: { nombreArchivo, contenidoBase64: adjuntoBase64 },
  });

  await registrarAuditoria(null, {
    empresaId,
    usuarioEjecutorId: usuarioId,
    accion: 'ENVIAR_CORREO',
    entidad: 'Reporte',
    entidadId: null,
    valoresDespues: toJson({ destinatario, nombreArchivo }),
  });

  return { enviado: true };
}

module.exports = {
  reporteVentas,
  reporteArticulosMasVendidos,
  reporteInventarioValorizado,
  reporteCompras,
  reporteCaja,
  enviar,
};
