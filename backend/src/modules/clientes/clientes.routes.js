const express = require('express');

// MOD-003 Clientes -- Fase 3
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const asyncHandler = require('../../shared/asyncHandler');
const auth = require('../../middlewares/auth.middleware');
const requierePermiso = require('../../middlewares/permisos.middleware');
const controller = require('./clientes.controller');

const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('clientes.ver'), asyncHandler(controller.listar));
router.get('/:id', requierePermiso('clientes.ver'), asyncHandler(controller.obtener));
router.post('/', requierePermiso('clientes.gestionar'), asyncHandler(controller.crear));
router.patch('/:id', requierePermiso('clientes.gestionar'), asyncHandler(controller.actualizar));

module.exports = router;
