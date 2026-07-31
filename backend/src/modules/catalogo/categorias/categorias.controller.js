const AppError = require('../../../shared/errors/AppError');
const service = require('./categorias.service');
const { crearCategoriaSchema, actualizarCategoriaSchema } = require('./categorias.validators');

async function listar(req, res) {
  const categorias = await service.listar({ empresaId: req.auth.empresaId });
  res.json(categorias);
}

async function crear(req, res) {
  const parsed = crearCategoriaSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de categoría inválidos.');
  const categoria = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    datos: parsed.data,
  });
  res.status(201).json(categoria);
}

async function actualizar(req, res) {
  const parsed = actualizarCategoriaSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de categoría inválidos.');
  const categoria = await service.actualizar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    categoriaId: req.params.id,
    datos: parsed.data,
  });
  res.json(categoria);
}

module.exports = { listar, crear, actualizar };
