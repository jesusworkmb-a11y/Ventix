const AppError = require('../../../shared/errors/AppError');
const service = require('./descuentos.service');
const { crearDescuentoSchema, actualizarDescuentoSchema } = require('./descuentos.validators');

async function listar(req, res) {
  const descuentos = await service.listar({ empresaId: req.auth.empresaId });
  res.json(descuentos);
}

async function crear(req, res) {
  const parsed = crearDescuentoSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de descuento inválidos.');
  const descuento = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    datos: parsed.data,
  });
  res.status(201).json(descuento);
}

async function actualizar(req, res) {
  const parsed = actualizarDescuentoSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de descuento inválidos.');
  const descuento = await service.actualizar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    descuentoId: req.params.id,
    datos: parsed.data,
  });
  res.json(descuento);
}

module.exports = { listar, crear, actualizar };
