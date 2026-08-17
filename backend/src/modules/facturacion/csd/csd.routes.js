const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./csd.controller');

// Mismo permiso que editar los datos fiscales (RFC/régimen) -- el CSD es dato fiscal tan o más
// sensible que esos.
const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('administracion.fiscal.editar'), asyncHandler(controller.listar));
router.post('/', requierePermiso('administracion.fiscal.editar'), asyncHandler(controller.registrar));

module.exports = router;
