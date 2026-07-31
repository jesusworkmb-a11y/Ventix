const AppError = require('../../../shared/errors/AppError');
const service = require('./usuarios.service');
const { crearUsuarioSchema, actualizarUsuarioSchema } = require('./usuarios.validators');

async function listar(req, res) {
  const usuarios = await service.listar({ empresaId: req.auth.empresaId });
  res.json(usuarios);
}

async function crear(req, res) {
  const parsed = crearUsuarioSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de usuario inválidos.');
  const usuario = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    datos: parsed.data,
  });
  res.status(201).json(usuario);
}

async function actualizar(req, res) {
  const parsed = actualizarUsuarioSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de usuario inválidos.');
  const usuario = await service.actualizar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    usuarioId: req.params.id,
    datos: parsed.data,
  });
  res.json(usuario);
}

module.exports = { listar, crear, actualizar };
