const AppError = require('../../../shared/errors/AppError');
const service = require('./superadmin.service');
const { cambiarEstadoSchema } = require('./superadmin.validators');

async function listarEmpresas(req, res) {
  const empresas = await service.listarEmpresas();
  res.json(empresas);
}

async function cambiarEstadoEmpresa(req, res) {
  const parsed = cambiarEstadoSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Estado inválido.');

  const empresa = await service.cambiarEstado({
    id: req.params.id,
    estado: parsed.data.estado,
    usuarioEjecutorId: req.auth.usuarioId,
  });
  res.json(empresa);
}

module.exports = { listarEmpresas, cambiarEstadoEmpresa };
