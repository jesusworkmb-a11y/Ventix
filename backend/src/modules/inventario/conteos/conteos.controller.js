const AppError = require('../../../shared/errors/AppError');
const service = require('./conteos.service');
const { crearConteoSchema, detallesConteoSchema, estadoConteoSchema } = require('./conteos.validators');

async function listar(req, res) {
  const { sucursalId, pagina, porPagina, ordenarPor, orden } = req.query;
  const conteos = await service.listar({
    empresaId: req.auth.empresaId,
    filtros: { sucursalId },
    paginacion: { pagina, porPagina },
    ordenamiento: { ordenarPor, orden },
  });
  res.json(conteos);
}

async function obtener(req, res) {
  const conteo = await service.obtener({ empresaId: req.auth.empresaId, conteoId: req.params.id });
  res.json(conteo);
}

async function crear(req, res) {
  const parsed = crearConteoSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de conteo inválidos.');
  const conteo = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    ...parsed.data,
  });
  res.status(201).json(conteo);
}

async function reemplazarDetalles(req, res) {
  const parsed = detallesConteoSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de líneas de conteo inválidos.');
  const detalles = await service.reemplazarDetalles({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    conteoId: req.params.id,
    detalles: parsed.data.detalles,
  });
  res.json(detalles);
}

async function cambiarEstado(req, res) {
  const parsed = estadoConteoSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Estado inválido.');
  const conteo = await service.cambiarEstado({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    conteoId: req.params.id,
    estado: parsed.data.estado,
  });
  res.json(conteo);
}

module.exports = { listar, obtener, crear, reemplazarDetalles, cambiarEstado };
