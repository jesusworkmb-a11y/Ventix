const prisma = require('../../config/db');

async function reporteVentas({ empresaId, sucursalId, desde, hasta }) {
  const where = { empresaId, estado: 'CONFIRMADA' };
  if (sucursalId) where.sucursalId = sucursalId;
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
  const pagosPorMetodo = ventaIds.length
    ? await prisma.pago.groupBy({ by: ['metodo'], where: { ventaId: { in: ventaIds } }, _sum: { monto: true } })
    : [];

  return {
    numeroVentas: resumen._count._all,
    subtotal: resumen._sum.subtotal || 0,
    impuestos: resumen._sum.impuestos || 0,
    total: resumen._sum.total || 0,
    ticketPromedio: resumen._avg.total || 0,
    porMetodoPago: pagosPorMetodo.map((p) => ({ metodo: p.metodo, monto: p._sum.monto })),
  };
}

// VentaDetalle no permite sumar cantidad × precio con groupBy de Prisma (solo suma columnas,
// no productos) — se traen las filas y se reduce en JS, escala pensada para una PyME.
async function reporteArticulosMasVendidos({ empresaId, sucursalId, desde, hasta, limite = 10 }) {
  const whereVenta = { empresaId, estado: 'CONFIRMADA' };
  if (sucursalId) whereVenta.sucursalId = sucursalId;
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
    select: { articuloId: true, cantidad: true, precio: true },
  });

  const acumulado = new Map();
  for (const d of detalles) {
    const actual = acumulado.get(d.articuloId) || { cantidad: 0, monto: 0 };
    actual.cantidad += Number(d.cantidad);
    actual.monto += Number(d.cantidad) * Number(d.precio);
    acumulado.set(d.articuloId, actual);
  }

  const articuloIds = [...acumulado.keys()];
  const articulos = await prisma.articulo.findMany({
    where: { id: { in: articuloIds } },
    select: { id: true, nombre: true, sku: true },
  });
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  return [...acumulado.entries()]
    .map(([articuloId, datos]) => ({ articulo: articuloPorId.get(articuloId) || null, ...datos }))
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

module.exports = {
  reporteVentas,
  reporteArticulosMasVendidos,
  reporteInventarioValorizado,
  reporteCompras,
  reporteCaja,
};
