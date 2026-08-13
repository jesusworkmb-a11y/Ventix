const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./facturas.controller');

const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('facturacion.ver'), asyncHandler(controller.listar));
router.get('/ventas-facturables', requierePermiso('facturacion.ver'), asyncHandler(controller.ventasFacturables));
router.get('/:id', requierePermiso('facturacion.ver'), asyncHandler(controller.obtener));

router.post('/directa', requierePermiso('facturacion.crear'), asyncHandler(controller.crearDirecta));
router.post('/desde-venta', requierePermiso('facturacion.crear'), asyncHandler(controller.crearDesdeVenta));
router.post('/agrupada', requierePermiso('facturacion.global.generar'), asyncHandler(controller.crearAgrupada));

router.patch('/:id/cancelar', requierePermiso('facturacion.cancelar'), asyncHandler(controller.cancelar));

module.exports = router;
