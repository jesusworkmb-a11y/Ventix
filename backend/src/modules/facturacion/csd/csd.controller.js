const AppError = require('../../../shared/errors/AppError');
const service = require('./csd.service');
const { registrarCsdSchema } = require('./csd.validators');

async function registrar(req, res) {
  const parsed = registrarCsdSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de CSD inválidos.');
  const csd = await service.registrar({ empresaId: req.auth.empresaId, usuarioId: req.auth.usuarioId, ...parsed.data });
  res.status(201).json(csd);
}

async function listar(req, res) {
  const csds = await service.listar({ empresaId: req.auth.empresaId });
  res.json(csds);
}

module.exports = { registrar, listar };
