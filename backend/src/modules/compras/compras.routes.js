const express = require('express');

// MOD-005 Compras -- Fase 5
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const asyncHandler = require('../../shared/asyncHandler');
const auth = require('../../middlewares/auth.middleware');
const requierePermiso = require('../../middlewares/permisos.middleware');
const controller = require('./compras.controller');
// Sub-recurso, no un módulo aparte (mismo criterio que ventas.routes.js con
// devoluciones/cotizaciones) — montado ANTES de la ruta '/:id' de abajo, para que
// '/compras/ordenes' no la intercepte como si "ordenes" fuera un id.
const ordenesRoutes = require('./ordenes/ordenes.routes');

const router = express.Router();
router.use(auth);

router.use('/ordenes', ordenesRoutes);

router.get('/', requierePermiso('compra.ver'), asyncHandler(controller.listar));
router.get('/:id', requierePermiso('compra.ver'), asyncHandler(controller.obtener));
router.post('/', requierePermiso('compra.crear'), asyncHandler(controller.crear));
router.patch('/:id/cancelar', requierePermiso('compra.cancelar'), asyncHandler(controller.cancelar));
router.post('/:id/enviar', requierePermiso('compra.ver'), asyncHandler(controller.enviar));

module.exports = router;
