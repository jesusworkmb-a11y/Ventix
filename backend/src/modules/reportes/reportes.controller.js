const AppError = require('../../shared/errors/AppError');
const { enviarDocumentoSchema } = require('../../shared/validators/enviarDocumento.validator');
const service = require('./reportes.service');

// `?dias=abc`/`?limite=abc` pasaban Number(valor) sin chequear NaN -- el default del service solo
// aplica a `undefined`, así que un query mal formado colaba un NaN hasta el cálculo (fecha de
// corte "Invalid Date" en reporteProductosSinMovimiento) en vez de un 400 claro (encontrado en la
// ronda de QA pre-lanzamiento).
function numeroQuery(valor, nombreParametro) {
  if (valor === undefined || valor === '') return undefined;
  const numero = Number(valor);
  if (Number.isNaN(numero)) throw new AppError(400, `El parámetro "${nombreParametro}" debe ser un número.`);
  return numero;
}

async function ventas(req, res) {
  const {
    desde, hasta, sucursalId, usuarioId, clienteId,
  } = req.query;
  const reporte = await service.reporteVentas({
    empresaId: req.auth.empresaId, desde, hasta, sucursalId, usuarioId, clienteId,
  });
  res.json(reporte);
}

async function articulosMasVendidos(req, res) {
  const {
    desde, hasta, sucursalId, limite, usuarioId, clienteId, categoriaId, tipo,
  } = req.query;
  const reporte = await service.reporteArticulosMasVendidos({
    empresaId: req.auth.empresaId,
    desde,
    hasta,
    sucursalId,
    limite: numeroQuery(limite, 'limite'),
    usuarioId,
    clienteId,
    categoriaId,
    tipo,
  });
  res.json(reporte);
}

async function utilidad(req, res) {
  const { desde, hasta, sucursalId } = req.query;
  const reporte = await service.reporteUtilidad({
    empresaId: req.auth.empresaId, desde, hasta, sucursalId,
  });
  res.json(reporte);
}

async function ventasPorCliente(req, res) {
  const { desde, hasta, sucursalId } = req.query;
  const reporte = await service.reporteVentasPorCliente({
    empresaId: req.auth.empresaId, desde, hasta, sucursalId,
  });
  res.json(reporte);
}

async function ivaTrasladado(req, res) {
  const { desde, hasta, clienteId } = req.query;
  const reporte = await service.reporteIvaTrasladado({
    empresaId: req.auth.empresaId, desde, hasta, clienteId,
  });
  res.json(reporte);
}

async function kardex(req, res) {
  const {
    articuloId, sucursalId, desde, hasta,
  } = req.query;
  const reporte = await service.reporteKardex({
    empresaId: req.auth.empresaId, articuloId, sucursalId, desde, hasta,
  });
  res.json(reporte);
}

async function productosSinMovimiento(req, res) {
  const { dias, categoriaId } = req.query;
  const reporte = await service.reporteProductosSinMovimiento({
    empresaId: req.auth.empresaId,
    dias: numeroQuery(dias, 'dias'),
    categoriaId,
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
  const {
    desde, hasta, cajaId, usuarioId,
  } = req.query;
  const reporte = await service.reporteCaja({
    empresaId: req.auth.empresaId, desde, hasta, cajaId, usuarioId,
  });
  res.json(reporte);
}

async function enviar(req, res) {
  const parsed = enviarDocumentoSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de envío inválidos.');
  const resultado = await service.enviar({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    ...parsed.data,
  });
  res.json(resultado);
}

module.exports = {
  ventas,
  articulosMasVendidos,
  utilidad,
  ventasPorCliente,
  ivaTrasladado,
  kardex,
  productosSinMovimiento,
  inventarioValorizado,
  compras,
  caja,
  enviar,
};
