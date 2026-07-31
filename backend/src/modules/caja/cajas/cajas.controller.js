const AppError = require('../../../shared/errors/AppError');
const service = require('./cajas.service');
const { crearCajaSchema, actualizarCajaSchema } = require('./cajas.validators');

async function listar(req, res) {
  const { sucursalId } = req.query;
  const cajas = await service.listar({ empresaId: req.auth.empresaId, filtros: { sucursalId } });
  res.json(cajas);
}

async function crear(req, res) {
  const parsed = crearCajaSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de caja inválidos.');
  const caja = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    ...parsed.data,
  });
  res.status(201).json(caja);
}

async function actualizar(req, res) {
  const parsed = actualizarCajaSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de caja inválidos.');
  const caja = await service.actualizar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    cajaId: req.params.id,
    datos: parsed.data,
  });
  res.json(caja);
}

module.exports = { listar, crear, actualizar };
