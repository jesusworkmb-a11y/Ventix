const prisma = require('../../../config/db');

// MovimientoInventario no declara relaciones Prisma (solo columnas FK planas, Kardex
// intencionalmente desacoplado) — se enriquecen artículo/sucursal con lookups aparte
// en vez de `include`, que no existe para este modelo.
async function listar(req, res) {
  const { sucursalId, articuloId, tipo, desde, hasta } = req.query;
  const where = { empresaId: req.auth.empresaId };
  if (sucursalId) where.sucursalId = sucursalId;
  if (articuloId) where.articuloId = articuloId;
  if (tipo) where.tipo = tipo;
  if (desde || hasta) {
    where.creadoEn = {};
    if (desde) where.creadoEn.gte = new Date(desde);
    if (hasta) where.creadoEn.lte = new Date(hasta);
  }

  const movimientos = await prisma.movimientoInventario.findMany({
    where,
    orderBy: { creadoEn: 'desc' },
    take: 200,
  });

  const articuloIds = [...new Set(movimientos.map((m) => m.articuloId))];
  const sucursalIds = [...new Set(movimientos.map((m) => m.sucursalId))];
  const [articulos, sucursales] = await Promise.all([
    prisma.articulo.findMany({ where: { id: { in: articuloIds } }, select: { id: true, nombre: true, sku: true } }),
    prisma.sucursal.findMany({ where: { id: { in: sucursalIds } }, select: { id: true, nombre: true } }),
  ]);
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));
  const sucursalPorId = new Map(sucursales.map((s) => [s.id, s]));

  res.json(movimientos.map((m) => ({
    ...m,
    articulo: articuloPorId.get(m.articuloId) || null,
    sucursal: sucursalPorId.get(m.sucursalId) || null,
  })));
}

module.exports = { listar };
