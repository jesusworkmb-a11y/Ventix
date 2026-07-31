const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./transferencias.controller');

const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('inventario.ver'), asyncHandler(controller.listar));
router.get('/:id', requierePermiso('inventario.ver'), asyncHandler(controller.obtener));
router.post('/', requierePermiso('inventario.transferir'), asyncHandler(controller.crear));
router.patch('/:id/recibir', requierePermiso('inventario.transferir'), asyncHandler(controller.recibir));

module.exports = router;
