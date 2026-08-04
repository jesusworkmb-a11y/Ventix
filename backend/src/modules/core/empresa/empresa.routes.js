const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./empresa.controller');

const router = express.Router();
router.use(auth);

router.patch('/', requierePermiso('administracion.empresa.editar'), asyncHandler(controller.actualizar));

module.exports = router;
