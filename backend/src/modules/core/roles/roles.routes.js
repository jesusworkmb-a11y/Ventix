const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./roles.controller');

const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('administracion.roles.ver'), asyncHandler(controller.listar));
router.post('/', requierePermiso('administracion.roles.gestionar'), asyncHandler(controller.crear));
router.patch('/:id', requierePermiso('administracion.roles.gestionar'), asyncHandler(controller.actualizar));
router.put('/:id/permisos', requierePermiso('administracion.roles.gestionar'), asyncHandler(controller.reemplazarPermisos));

module.exports = router;
