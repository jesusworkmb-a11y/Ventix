const AppError = require('../../../shared/errors/AppError');
const service = require('./promociones.service');
const { crearPromocionSchema, actualizarPromocionSchema } = require('./promociones.validators');

async function listar(req, res) {
  const promociones = await service.listar({ empresaId: req.auth.empresaId });
  res.json(promociones);
}

async function crear(req, res) {
  const parsed = crearPromocionSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de promoción inválidos.');
  const promocion = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    datos: parsed.data,
  });
  res.status(201).json(promocion);
}

async function actualizar(req, res) {
  const parsed = actualizarPromocionSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de promoción inválidos.');
  const promocion = await service.actualizar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    promocionId: req.params.id,
    datos: parsed.data,
  });
  res.json(promocion);
}

async function eliminar(req, res) {
  await service.eliminar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    promocionId: req.params.id,
  });
  res.status(204).send();
}

module.exports = { listar, crear, actualizar, eliminar };
