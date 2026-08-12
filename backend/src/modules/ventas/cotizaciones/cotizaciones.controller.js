const AppError = require('../../../shared/errors/AppError');
const { enviarDocumentoSchema } = require('../../../shared/validators/enviarDocumento.validator');
const service = require('./cotizaciones.service');
const { crearCotizacionSchema, convertirCotizacionSchema } = require('./cotizaciones.validators');

async function listar(req, res) {
  const { buscar, pagina, porPagina, ordenarPor, orden } = req.query;
  const cotizaciones = await service.listar({
    empresaId: req.auth.empresaId,
    filtros: { buscar },
    paginacion: { pagina, porPagina },
    ordenamiento: { ordenarPor, orden },
  });
  res.json(cotizaciones);
}

async function obtener(req, res) {
  const cotizacion = await service.obtener({ empresaId: req.auth.empresaId, cotizacionId: req.params.id });
  res.json(cotizacion);
}

async function crear(req, res) {
  const parsed = crearCotizacionSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de cotización inválidos.');
  const cotizacion = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    ...parsed.data,
  });
  res.status(201).json(cotizacion);
}

async function convertir(req, res) {
  const parsed = convertirCotizacionSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de conversión inválidos.');
  const venta = await service.convertir({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    rolId: req.auth.rolId,
    cotizacionId: req.params.id,
    ...parsed.data,
  });
  res.status(201).json(venta);
}

async function enviar(req, res) {
  const parsed = enviarDocumentoSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de envío inválidos.');
  const resultado = await service.enviar({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    cotizacionId: req.params.id,
    ...parsed.data,
  });
  res.json(resultado);
}

module.exports = {
  listar, obtener, crear, convertir, enviar,
};
