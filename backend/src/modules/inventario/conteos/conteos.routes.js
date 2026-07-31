const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./conteos.controller');

const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('inventario.ver'), asyncHandler(controller.listar));
router.get('/:id', requierePermiso('inventario.ver'), asyncHandler(controller.obtener));
router.post('/', requierePermiso('inventario.conteo_fisico'), asyncHandler(controller.crear));
router.put('/:id/detalles', requierePermiso('inventario.conteo_fisico'), asyncHandler(controller.reemplazarDetalles));
router.patch('/:id/estado', requierePermiso('inventario.conteo_fisico'), asyncHandler(controller.cambiarEstado));

module.exports = router;
