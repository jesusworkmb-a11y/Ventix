const AppError = require('../../../shared/errors/AppError');
const service = require('./unidades.service');
const { crearUnidadSchema, actualizarUnidadSchema } = require('./unidades.validators');

async function listar(req, res) {
  const unidades = await service.listar({ empresaId: req.auth.empresaId });
  res.json(unidades);
}

async function crear(req, res) {
  const parsed = crearUnidadSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de unidad inválidos.');
  const unidad = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    datos: parsed.data,
  });
  res.status(201).json(unidad);
}

async function actualizar(req, res) {
  const parsed = actualizarUnidadSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de unidad inválidos.');
  const unidad = await service.actualizar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    unidadId: req.params.id,
    datos: parsed.data,
  });
  res.json(unidad);
}

module.exports = { listar, crear, actualizar };
