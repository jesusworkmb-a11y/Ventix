const AppError = require('../../../shared/errors/AppError');
const service = require('./empresa.service');
const { actualizarEmpresaSchema } = require('./empresa.validators');

async function actualizar(req, res) {
  const parsed = actualizarEmpresaSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de empresa inválidos.');
  const empresa = await service.actualizar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    datos: parsed.data,
  });
  res.json(empresa);
}

module.exports = { actualizar };
