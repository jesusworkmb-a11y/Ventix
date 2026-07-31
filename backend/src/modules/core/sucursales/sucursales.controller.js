const AppError = require('../../../shared/errors/AppError');
const service = require('./sucursales.service');
const { crearSucursalSchema, actualizarSucursalSchema } = require('./sucursales.validators');

async function listar(req, res) {
  const sucursales = await service.listar({ empresaId: req.auth.empresaId });
  res.json(sucursales);
}

async function crear(req, res) {
  const parsed = crearSucursalSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de sucursal inválidos.');
  const sucursal = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    datos: parsed.data,
  });
  res.status(201).json(sucursal);
}

async function actualizar(req, res) {
  const parsed = actualizarSucursalSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de sucursal inválidos.');
  const sucursal = await service.actualizar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    sucursalId: req.params.id,
    datos: parsed.data,
  });
  res.json(sucursal);
}

module.exports = { listar, crear, actualizar };
