const AppError = require('../../../shared/errors/AppError');
const service = require('./devoluciones.service');
const { crearDevolucionSchema } = require('./devoluciones.validators');

async function listar(req, res) {
  const { ventaId } = req.query;
  const devoluciones = await service.listar({ empresaId: req.auth.empresaId, filtros: { ventaId } });
  res.json(devoluciones);
}

async function obtener(req, res) {
  const devolucion = await service.obtener({ empresaId: req.auth.empresaId, devolucionId: req.params.id });
  res.json(devolucion);
}

async function crear(req, res) {
  const parsed = crearDevolucionSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de devolución inválidos.');
  const devolucion = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    ...parsed.data,
  });
  res.status(201).json(devolucion);
}

module.exports = { listar, obtener, crear };
