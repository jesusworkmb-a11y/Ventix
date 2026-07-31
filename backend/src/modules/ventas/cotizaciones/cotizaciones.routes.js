const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./cotizaciones.controller');

const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('venta.ver'), asyncHandler(controller.listar));
router.get('/:id', requierePermiso('venta.ver'), asyncHandler(controller.obtener));
router.post('/', requierePermiso('venta.crear'), asyncHandler(controller.crear));
router.post('/:id/convertir', requierePermiso('venta.crear'), asyncHandler(controller.convertir));

module.exports = router;
