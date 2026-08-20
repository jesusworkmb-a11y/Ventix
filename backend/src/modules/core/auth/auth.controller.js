const AppError = require('../../../shared/errors/AppError');
const authService = require('./auth.service');
const {
  registroSchema, loginSchema, recuperarSchema, restablecerSchema,
} = require('./auth.validators');

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

async function recuperar(req, res) {
  const parsed = recuperarSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Correo o número de empresa inválidos.');

  const resultado = await authService.solicitarRecuperacion(parsed.data);
  res.json(resultado);
}

async function restablecer(req, res) {
  const parsed = restablecerSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'La contraseña nueva debe tener al menos 8 caracteres.');

  await authService.restablecerPassword(parsed.data);
  res.json({ mensaje: 'Contraseña actualizada. Ya podés iniciar sesión.' });
}

module.exports = {
  registro, login, me, recuperar, restablecer,
};
