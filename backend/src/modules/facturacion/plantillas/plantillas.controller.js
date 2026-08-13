const AppError = require('../../../shared/errors/AppError');
const service = require('./plantillas.service');
const { listarSchema, crearSchema, actualizarSchema } = require('./plantillas.validators');

async function listar(req, res) {
  const parsed = listarSchema.safeParse(req.query);
  if (!parsed.success) throw new AppError(400, 'Filtros inválidos.');
  const plantillas = await service.listar({ empresaId: req.auth.empresaId, ...parsed.data });
  res.json(plantillas);
}

async function crear(req, res) {
  const parsed = crearSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de plantilla inválidos.');
  const plantilla = await service.crear({ empresaId: req.auth.empresaId, ...parsed.data });
  res.status(201).json(plantilla);
}

async function actualizar(req, res) {
  const parsed = actualizarSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos inválidos.');
  const plantilla = await service.actualizar({
    empresaId: req.auth.empresaId,
    plantillaId: req.params.id,
    ...parsed.data,
  });
  res.json(plantilla);
}

async function eliminar(req, res) {
  await service.eliminar({ empresaId: req.auth.empresaId, plantillaId: req.params.id });
  res.status(204).send();
}

async function registrarUso(req, res) {
  await service.registrarUso({ empresaId: req.auth.empresaId, plantillaId: req.params.id });
  res.status(204).send();
}

module.exports = { listar, crear, actualizar, eliminar, registrarUso };
