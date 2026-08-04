const AppError = require('../../../shared/errors/AppError');
const service = require('./articulos.service');
const {
  crearArticuloSchema,
  actualizarArticuloSchema,
  unidadesAlternasSchema,
  preciosSchema,
} = require('./articulos.validators');

async function listar(req, res) {
  const { tipo, activo, categoriaId, buscar, pagina, porPagina, ordenarPor, orden } = req.query;
  const articulos = await service.listar({
    empresaId: req.auth.empresaId,
    filtros: {
      tipo,
      activo: activo === undefined ? undefined : activo === 'true',
      categoriaId,
      buscar,
    },
    paginacion: { pagina, porPagina },
    ordenamiento: { ordenarPor, orden },
  });
  res.json(articulos);
}

async function obtener(req, res) {
  const articulo = await service.obtener({ empresaId: req.auth.empresaId, articuloId: req.params.id });
  res.json(articulo);
}

async function crear(req, res) {
  const parsed = crearArticuloSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de artículo inválidos.');
  const articulo = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    datos: parsed.data,
  });
  res.status(201).json(articulo);
}

async function actualizar(req, res) {
  const parsed = actualizarArticuloSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de artículo inválidos.');
  const articulo = await service.actualizar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    articuloId: req.params.id,
    datos: parsed.data,
  });
  res.json(articulo);
}

async function actualizarUnidadesAlternas(req, res) {
  const parsed = unidadesAlternasSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de unidades alternas inválidos.');
  const resultado = await service.setUnidadesAlternas({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    articuloId: req.params.id,
    unidadesAlternas: parsed.data.unidadesAlternas,
  });
  res.json(resultado);
}

async function actualizarPrecios(req, res) {
  const parsed = preciosSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de precios inválidos.');
  const resultado = await service.setPrecios({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    articuloId: req.params.id,
    precios: parsed.data.precios,
  });
  res.json(resultado);
}

module.exports = { listar, obtener, crear, actualizar, actualizarUnidadesAlternas, actualizarPrecios };
