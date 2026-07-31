const AppError = require('../../../shared/errors/AppError');
const service = require('./listasPrecio.service');
const { crearListaPrecioSchema, actualizarListaPrecioSchema } = require('./listasPrecio.validators');

async function listar(req, res) {
  const listas = await service.listar({ empresaId: req.auth.empresaId });
  res.json(listas);
}

async function crear(req, res) {
  const parsed = crearListaPrecioSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de lista de precio inválidos.');
  const lista = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    datos: parsed.data,
  });
  res.status(201).json(lista);
}

async function actualizar(req, res) {
  const parsed = actualizarListaPrecioSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de lista de precio inválidos.');
  const lista = await service.actualizar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    listaPrecioId: req.params.id,
    datos: parsed.data,
  });
  res.json(lista);
}

module.exports = { listar, crear, actualizar };
