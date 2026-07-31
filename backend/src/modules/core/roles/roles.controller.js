const AppError = require('../../../shared/errors/AppError');
const service = require('./roles.service');
const { crearRolSchema, actualizarRolSchema, permisosRolSchema } = require('./roles.validators');

async function listar(req, res) {
  const roles = await service.listar({ empresaId: req.auth.empresaId });
  res.json(roles);
}

async function crear(req, res) {
  const parsed = crearRolSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Nombre de rol inválido.');
  const rol = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    nombre: parsed.data.nombre,
  });
  res.status(201).json(rol);
}

async function actualizar(req, res) {
  const parsed = actualizarRolSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Nombre de rol inválido.');
  const rol = await service.actualizar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    rolId: req.params.id,
    nombre: parsed.data.nombre,
  });
  res.json(rol);
}

async function reemplazarPermisos(req, res) {
  const parsed = permisosRolSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Lista de permisos inválida.');
  const claves = await service.reemplazarPermisos({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    rolId: req.params.id,
    claves: parsed.data.claves,
  });
  res.json({ claves });
}

module.exports = { listar, crear, actualizar, reemplazarPermisos };
