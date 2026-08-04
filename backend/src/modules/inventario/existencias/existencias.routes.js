const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./existencias.controller');

const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('inventario.ver'), asyncHandler(controller.listar));
router.get('/exportar', requierePermiso('inventario.ver'), asyncHandler(controller.exportar));
router.post('/inicial', requierePermiso('inventario.ajustar'), asyncHandler(controller.establecerInicial));

module.exports = router;
