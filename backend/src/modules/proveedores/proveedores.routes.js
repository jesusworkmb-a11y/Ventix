const express = require('express');

// MOD-004 Proveedores -- Fase 3
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const asyncHandler = require('../../shared/asyncHandler');
const auth = require('../../middlewares/auth.middleware');
const requierePermiso = require('../../middlewares/permisos.middleware');
const controller = require('./proveedores.controller');

const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('proveedores.ver'), asyncHandler(controller.listar));
router.get('/:id', requierePermiso('proveedores.ver'), asyncHandler(controller.obtener));
router.post('/', requierePermiso('proveedores.gestionar'), asyncHandler(controller.crear));
router.patch('/:id', requierePermiso('proveedores.gestionar'), asyncHandler(controller.actualizar));

module.exports = router;
