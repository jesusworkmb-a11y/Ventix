const express = require('express');

// MOD-005 Compras -- Fase 5
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const asyncHandler = require('../../shared/asyncHandler');
const auth = require('../../middlewares/auth.middleware');
const requierePermiso = require('../../middlewares/permisos.middleware');
const controller = require('./compras.controller');

const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('compra.ver'), asyncHandler(controller.listar));
router.get('/:id', requierePermiso('compra.ver'), asyncHandler(controller.obtener));
router.post('/', requierePermiso('compra.crear'), asyncHandler(controller.crear));
router.patch('/:id/cancelar', requierePermiso('compra.cancelar'), asyncHandler(controller.cancelar));
router.post('/:id/enviar', requierePermiso('compra.ver'), asyncHandler(controller.enviar));

module.exports = router;
