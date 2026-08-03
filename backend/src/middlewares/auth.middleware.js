const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const AppError = require('../shared/errors/AppError');

// Verifica el Bearer token y deja identidad en req.auth. Todo endpoint de módulos futuros
// debe filtrar sus queries con req.auth.empresaId — nunca confiar en un empresaId del body/params.
async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'Debes iniciar sesión para continuar.'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Revalida el estado actual del usuario en cada request (no solo al emitir el token):
    // si un admin bloquea/desactiva a alguien, sus tokens ya emitidos deben dejar de servir
    // de inmediato en vez de seguir siendo válidos hasta que expiren solos.
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { estado: true },
    });
    if (!usuario || usuario.estado !== 'ACTIVO') {
      return next(new AppError(401, 'Tu sesión ya no es válida. Inicia sesión de nuevo.'));
    }

    req.auth = { usuarioId: payload.sub, empresaId: payload.empresaId, rolId: payload.rolId };
    next();
  } catch (error) {
    next(new AppError(401, 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.'));
  }
}

module.exports = auth;
