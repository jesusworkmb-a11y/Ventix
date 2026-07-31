const AppError = require('../../../shared/errors/AppError');
const service = require('./impuestos.service');
const { crearImpuestoSchema, actualizarImpuestoSchema } = require('./impuestos.validators');

async function listar(req, res) {
  const impuestos = await service.listar({ empresaId: req.auth.empresaId });
  res.json(impuestos);
}

async function crear(req, res) {
  const parsed = crearImpuestoSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de impuesto inválidos.');
  const impuesto = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    datos: parsed.data,
  });
  res.status(201).json(impuesto);
}

async function actualizar(req, res) {
  const parsed = actualizarImpuestoSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de impuesto inválidos.');
  const impuesto = await service.actualizar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    impuestoId: req.params.id,
    datos: parsed.data,
  });
  res.json(impuesto);
}

module.exports = { listar, crear, actualizar };
