const AppError = require('../shared/errors/AppError');
const { usuarioTienePermiso } = require('../shared/services/permisos.service');

// Guard de ruta: exige que req.auth (ya seteado por auth.middleware) tenga la clave dada.
function requierePermiso(clave) {
  return async (req, res, next) => {
    // El superadmin de plataforma no pertenece a ninguna empresa (rolId null en su token) y
    // los permisos son 100% por-empresa: no hay rol contra el cual resolver la clave, así que
    // se le niega de forma limpia en vez de dejar que RolPermiso.findUnique truene con rolId
    // null. Su acceso vive aparte, en las rutas /superadmin (requiereSuperAdmin).
    if (req.auth.esSuperAdmin) {
      return next(new AppError(403, 'No tienes permiso para realizar esta acción.'));
    }
    try {
      const tiene = await usuarioTienePermiso({
        usuarioId: req.auth.usuarioId,
        rolId: req.auth.rolId,
        clave,
      });
      if (!tiene) return next(new AppError(403, 'No tienes permiso para realizar esta acción.'));
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = requierePermiso;
