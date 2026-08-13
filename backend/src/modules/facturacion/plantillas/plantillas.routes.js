const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./plantillas.controller');

const router = express.Router();
router.use(auth);
// Mismo permiso que crear una Factura Directa -- las plantillas solo existen dentro de ese
// flujo de captura, no son una entidad de gestión aparte.
router.use(requierePermiso('facturacion.crear'));

router.get('/', asyncHandler(controller.listar));
router.post('/', asyncHandler(controller.crear));
router.patch('/:id', asyncHandler(controller.actualizar));
router.delete('/:id', asyncHandler(controller.eliminar));
router.post('/:id/registrar-uso', asyncHandler(controller.registrarUso));

module.exports = router;
