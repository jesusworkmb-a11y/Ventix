const AppError = require('../../../shared/errors/AppError');
const service = require('./superadmin.service');
const { cambiarEstadoSchema, actualizarVigenciaSchema, actualizarPlanSchema } = require('./superadmin.validators');

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

async function actualizarVigenciaEmpresa(req, res) {
  const parsed = actualizarVigenciaSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Fecha de vigencia inválida.');

  const empresa = await service.actualizarVigencia({
    id: req.params.id,
    vigenciaHasta: parsed.data.vigenciaHasta,
    usuarioEjecutorId: req.auth.usuarioId,
  });
  res.json(empresa);
}

async function actualizarPlanEmpresa(req, res) {
  const parsed = actualizarPlanSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Plan inválido.');

  const empresa = await service.actualizarPlan({
    id: req.params.id,
    plan: parsed.data.plan,
    usuarioEjecutorId: req.auth.usuarioId,
  });
  res.json(empresa);
}

module.exports = { listarEmpresas, cambiarEstadoEmpresa, actualizarVigenciaEmpresa, actualizarPlanEmpresa };
