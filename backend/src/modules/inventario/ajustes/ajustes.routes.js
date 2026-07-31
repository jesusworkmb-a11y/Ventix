const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./ajustes.controller');

const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('inventario.ver'), asyncHandler(controller.listar));
router.get('/:id', requierePermiso('inventario.ver'), asyncHandler(controller.obtener));
router.post('/', requierePermiso('inventario.ajustar'), asyncHandler(controller.crear));

module.exports = router;
