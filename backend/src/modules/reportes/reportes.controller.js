const service = require('./reportes.service');

async function ventas(req, res) {
  const { desde, hasta, sucursalId } = req.query;
  const reporte = await service.reporteVentas({ empresaId: req.auth.empresaId, desde, hasta, sucursalId });
  res.json(reporte);
}

async function articulosMasVendidos(req, res) {
  const { desde, hasta, sucursalId, limite } = req.query;
  const reporte = await service.reporteArticulosMasVendidos({
    empresaId: req.auth.empresaId,
    desde,
    hasta,
    sucursalId,
    limite: limite ? Number(limite) : undefined,
  });
  res.json(reporte);
}

async function inventarioValorizado(req, res) {
  const { sucursalId } = req.query;
  const reporte = await service.reporteInventarioValorizado({ empresaId: req.auth.empresaId, sucursalId });
  res.json(reporte);
}

async function compras(req, res) {
  const { desde, hasta, sucursalId } = req.query;
  const reporte = await service.reporteCompras({ empresaId: req.auth.empresaId, desde, hasta, sucursalId });
  res.json(reporte);
}

async function caja(req, res) {
  const { desde, hasta, cajaId } = req.query;
  const reporte = await service.reporteCaja({ empresaId: req.auth.empresaId, desde, hasta, cajaId });
  res.json(reporte);
}

module.exports = { ventas, articulosMasVendidos, inventarioValorizado, compras, caja };
