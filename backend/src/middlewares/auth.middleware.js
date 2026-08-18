const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const AppError = require('../shared/errors/AppError');
const { formatearFechaCorta } = require('../shared/formatearFecha');

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
      select: { estado: true, esSuperAdmin: true },
    });
    if (!usuario || usuario.estado !== 'ACTIVO') {
      return next(new AppError(401, 'Tu sesión ya no es válida. Inicia sesión de nuevo.'));
    }

    // Superadmin de plataforma: no tiene empresaId/rolId (su token se emitió sin ellos), así
    // que no pasa por UsuarioEmpresa ni por el check de empresa de abajo.
    if (usuario.esSuperAdmin) {
      req.auth = { usuarioId: payload.sub, empresaId: null, rolId: null, esSuperAdmin: true };
      return next();
    }

    // Mismo criterio para el rol: el `rolId` del JWT es una foto del momento del login, no una
    // fuente de verdad. Sin esto, degradar/reasignar el rol de un usuario (o desactivar su
    // vínculo con la empresa) no tenía efecto sobre sesiones ya abiertas hasta que el token
    // expirara solo (hasta 8h) — un admin recién degradado a Cajero seguía pudiendo crear
    // sucursales, por ejemplo. Se resuelve en vivo en cada request, igual que el estado.
    const usuarioEmpresa = await prisma.usuarioEmpresa.findFirst({
      where: { usuarioId: payload.sub, empresaId: payload.empresaId, activo: true },
      select: { rolId: true, empresa: { select: { estado: true, vigenciaHasta: true } } },
    });
    if (!usuarioEmpresa) {
      return next(new AppError(401, 'Tu sesión ya no es válida. Inicia sesión de nuevo.'));
    }
    // Mismo patrón: si la empresa se suspende, las sesiones ya abiertas de sus usuarios deben
    // cortarse de inmediato, no seguir sirviendo hasta que el JWT expire solo.
    if (usuarioEmpresa.empresa.estado !== 'ACTIVA') {
      return next(new AppError(403, 'Esta empresa está suspendida. Contacta al administrador de la plataforma.'));
    }
    const { vigenciaHasta } = usuarioEmpresa.empresa;
    if (vigenciaHasta && vigenciaHasta < new Date()) {
      return next(new AppError(
        403,
        `La vigencia de tu suscripción venció el ${formatearFechaCorta(vigenciaHasta)}. Contacta al administrador de la plataforma para renovarla.`,
      ));
    }

    req.auth = { usuarioId: payload.sub, empresaId: payload.empresaId, rolId: usuarioEmpresa.rolId, esSuperAdmin: false };
    next();
  } catch (error) {
    next(new AppError(401, 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.'));
  }
}

module.exports = auth;
