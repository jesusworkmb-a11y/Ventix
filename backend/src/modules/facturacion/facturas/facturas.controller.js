const AppError = require('../../../shared/errors/AppError');
const service = require('./facturas.service');
const {
  crearDirectaSchema,
  crearDesdeVentaSchema,
  crearAgrupadaSchema,
  cancelarSchema,
  ventasFacturablesSchema,
  sugerenciaSchema,
} = require('./facturas.validators');

async function listar(req, res) {
  const { pagina, porPagina, ordenarPor, orden, buscar, tipo, estado } = req.query;
  const resultado = await service.listar({
    empresaId: req.auth.empresaId,
    filtros: { buscar, tipo, estado },
    paginacion: { pagina, porPagina },
    ordenamiento: { ordenarPor, orden },
  });
  res.json(resultado);
}

async function obtener(req, res) {
  const factura = await service.obtener({ empresaId: req.auth.empresaId, facturaId: req.params.id });
  res.json(factura);
}

async function ventasFacturables(req, res) {
  const parsed = ventasFacturablesSchema.safeParse(req.query);
  if (!parsed.success) throw new AppError(400, 'Filtros inválidos.');
  const ventas = await service.listarVentasFacturables({ empresaId: req.auth.empresaId, ...parsed.data });
  res.json(ventas);
}

async function sugerencia(req, res) {
  const parsed = sugerenciaSchema.safeParse(req.query);
  if (!parsed.success) throw new AppError(400, 'Filtros inválidos.');
  const factura = await service.obtenerSugerencia({ empresaId: req.auth.empresaId, ...parsed.data });
  res.json(factura);
}

async function crearDirecta(req, res) {
  const parsed = crearDirectaSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de factura inválidos.');
  const factura = await service.crearDirecta({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    ...parsed.data,
  });
  res.status(201).json(factura);
}

async function crearDesdeVenta(req, res) {
  const parsed = crearDesdeVentaSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de factura inválidos.');
  const factura = await service.crearDesdeVenta({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    tipo: 'VENTA_POS',
    ...parsed.data,
  });
  res.status(201).json(factura);
}

async function crearAgrupada(req, res) {
  const parsed = crearAgrupadaSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de factura inválidos.');
  const factura = await service.crearAgrupada({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    ...parsed.data,
  });
  res.status(201).json(factura);
}

async function cancelar(req, res) {
  const parsed = cancelarSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de cancelación inválidos.');
  const factura = await service.cancelar({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    facturaId: req.params.id,
    ...parsed.data,
  });
  res.json(factura);
}

module.exports = {
  listar, obtener, ventasFacturables, sugerencia, crearDirecta, crearDesdeVenta, crearAgrupada, cancelar,
};
