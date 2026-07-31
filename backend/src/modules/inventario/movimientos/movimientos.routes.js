const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./movimientos.controller');

const router = express.Router();
router.use(auth);
router.get('/', requierePermiso('inventario.ver'), asyncHandler(controller.listar));

module.exports = router;
