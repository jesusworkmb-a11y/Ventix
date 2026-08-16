const express = require('express');

// MOD-009 Reportes -- Fase 9
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const asyncHandler = require('../../shared/asyncHandler');
const auth = require('../../middlewares/auth.middleware');
const requierePermiso = require('../../middlewares/permisos.middleware');
const controller = require('./reportes.controller');

const router = express.Router();
router.use(auth);
router.use(requierePermiso('reportes.ver'));

router.get('/ventas', asyncHandler(controller.ventas));
router.get('/articulos-mas-vendidos', asyncHandler(controller.articulosMasVendidos));
router.get('/utilidad', asyncHandler(controller.utilidad));
router.get('/ventas-por-cliente', asyncHandler(controller.ventasPorCliente));
router.get('/iva-trasladado', asyncHandler(controller.ivaTrasladado));
router.get('/kardex', asyncHandler(controller.kardex));
router.get('/productos-sin-movimiento', asyncHandler(controller.productosSinMovimiento));
router.get('/inventario-valorizado', asyncHandler(controller.inventarioValorizado));
router.get('/compras', asyncHandler(controller.compras));
router.get('/caja', asyncHandler(controller.caja));
router.post('/enviar', asyncHandler(controller.enviar));

module.exports = router;
