const AppError = require('../../../shared/errors/AppError');
const service = require('./portalPublico.service');
const { buscarVentaSchema, facturarSchema } = require('./portalPublico.validators');

async function obtenerEmpresa(req, res) {
  const empresa = await service.obtenerEmpresaPublica({ slug: req.params.slug });
  res.json(empresa);
}

async function buscarVenta(req, res) {
  const parsed = buscarVentaSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Folio y monto son obligatorios.');
  const venta = await service.buscarVenta({ slug: req.params.slug, ...parsed.data });
  res.json(venta);
}

async function facturar(req, res) {
  const parsed = facturarSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de factura inválidos.');
  const factura = await service.facturar({ slug: req.params.slug, ...parsed.data });
  res.status(201).json(factura);
}

module.exports = { obtenerEmpresa, buscarVenta, facturar };
