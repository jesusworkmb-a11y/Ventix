const express = require('express');

// Sub-recurso de MOD-005 Compras — órdenes de compra (solicitud al proveedor, sin efecto de
// stock/dinero hasta que se reciben contra una Compra, ver compras.service.js#crear).
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./ordenes.controller');

const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('compra.orden.ver'), asyncHandler(controller.listar));
router.get('/:id', requierePermiso('compra.orden.ver'), asyncHandler(controller.obtener));
router.post('/', requierePermiso('compra.orden.crear'), asyncHandler(controller.crear));
router.patch('/:id/cancelar', requierePermiso('compra.orden.cancelar'), asyncHandler(controller.cancelar));
router.patch('/:id/cerrar', requierePermiso('compra.orden.cancelar'), asyncHandler(controller.cerrar));
router.post('/:id/enviar', requierePermiso('compra.orden.ver'), asyncHandler(controller.enviar));

module.exports = router;
