const AppError = require('../../../shared/errors/AppError');
const service = require('./marcas.service');
const { crearMarcaSchema, actualizarMarcaSchema } = require('./marcas.validators');

async function listar(req, res) {
  const marcas = await service.listar({ empresaId: req.auth.empresaId });
  res.json(marcas);
}

async function crear(req, res) {
  const parsed = crearMarcaSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Nombre de marca inválido.');
  const marca = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    nombre: parsed.data.nombre,
  });
  res.status(201).json(marca);
}

async function actualizar(req, res) {
  const parsed = actualizarMarcaSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Nombre de marca inválido.');
  const marca = await service.actualizar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    marcaId: req.params.id,
    nombre: parsed.data.nombre,
  });
  res.json(marca);
}

module.exports = { listar, crear, actualizar };
