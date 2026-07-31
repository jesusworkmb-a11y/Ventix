const AppError = require('../../../shared/errors/AppError');
const service = require('./ventas.service');
const { crearVentaSchema } = require('./ventas.validators');

async function listar(req, res) {
  const { clienteId, sucursalId, estado, desde, hasta } = req.query;
  const ventas = await service.listar({
    empresaId: req.auth.empresaId,
    filtros: { clienteId, sucursalId, estado, desde, hasta },
  });
  res.json(ventas);
}

async function obtener(req, res) {
  const venta = await service.obtener({ empresaId: req.auth.empresaId, ventaId: req.params.id });
  res.json(venta);
}

async function crear(req, res) {
  const parsed = crearVentaSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de venta inválidos.');
  const venta = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    rolId: req.auth.rolId,
    ...parsed.data,
  });
  res.status(201).json(venta);
}

async function cancelar(req, res) {
  const venta = await service.cancelar({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    ventaId: req.params.id,
  });
  res.json(venta);
}

module.exports = { listar, obtener, crear, cancelar };
