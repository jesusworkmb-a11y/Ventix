const AppError = require('../shared/errors/AppError');

// Guard hermano de requierePermiso, no dentro del mismo sistema: los permisos son 100%
// por-empresa (Rol.empresaId), y el superadmin de plataforma no pertenece a ninguna.
function requiereSuperAdmin(req, res, next) {
  if (!req.auth?.esSuperAdmin) {
    return next(new AppError(403, 'No tienes permiso para realizar esta acción.'));
  }
  next();
}

module.exports = requiereSuperAdmin;
