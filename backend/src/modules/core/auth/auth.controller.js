const AppError = require('../../../shared/errors/AppError');
const authService = require('./auth.service');
const { registroSchema, loginSchema } = require('./auth.validators');

async function registro(req, res) {
  const parsed = registroSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de registro inválidos.');

  const resultado = await authService.registrarEmpresa(parsed.data);
  res.status(201).json({
    token: resultado.token,
    usuario: resultado.usuario,
    empresa: resultado.empresa,
    rol: resultado.rol,
  });
}

async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Correo o contraseña inválidos.');

  const resultado = await authService.login(parsed.data);
  res.json(resultado);
}

async function me(req, res) {
  const resultado = await authService.obtenerMe(req.auth);
  res.json(resultado);
}

module.exports = { registro, login, me };
