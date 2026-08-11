const AppError = require('../../../shared/errors/AppError');
const service = require('./atributos.service');
const {
  crearAtributoSchema,
  actualizarAtributoSchema,
  crearValorSchema,
  actualizarValorSchema,
} = require('./atributos.validators');

async function listar(req, res) {
  const atributos = await service.listar({ empresaId: req.auth.empresaId });
  res.json(atributos);
}

async function crear(req, res) {
  const parsed = crearAtributoSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de atributo inválidos.');
  const atributo = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    datos: parsed.data,
  });
  res.status(201).json(atributo);
}

async function actualizar(req, res) {
  const parsed = actualizarAtributoSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de atributo inválidos.');
  const atributo = await service.actualizar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    atributoId: req.params.id,
    datos: parsed.data,
  });
  res.json(atributo);
}

async function eliminar(req, res) {
  await service.eliminar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    atributoId: req.params.id,
  });
  res.status(204).send();
}

async function agregarValor(req, res) {
  const parsed = crearValorSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de valor inválidos.');
  const valor = await service.agregarValor({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    atributoId: req.params.id,
    datos: parsed.data,
  });
  res.status(201).json(valor);
}

async function actualizarValor(req, res) {
  const parsed = actualizarValorSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de valor inválidos.');
  const valor = await service.actualizarValor({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    valorId: req.params.valorId,
    datos: parsed.data,
  });
  res.json(valor);
}

async function eliminarValor(req, res) {
  await service.eliminarValor({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    valorId: req.params.valorId,
  });
  res.status(204).send();
}

module.exports = { listar, crear, actualizar, eliminar, agregarValor, actualizarValor, eliminarValor };
