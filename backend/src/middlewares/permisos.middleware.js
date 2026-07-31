const AppError = require('../shared/errors/AppError');
const { usuarioTienePermiso } = require('../shared/services/permisos.service');

// Guard de ruta: exige que req.auth (ya seteado por auth.middleware) tenga la clave dada.
function requierePermiso(clave) {
  return async (req, res, next) => {
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
