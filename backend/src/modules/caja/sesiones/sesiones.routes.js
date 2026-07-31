const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./sesiones.controller');

const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('caja.ver'), asyncHandler(controller.listar));
router.get('/:id', requierePermiso('caja.ver'), asyncHandler(controller.obtener));
router.post('/', requierePermiso('caja.abrir'), asyncHandler(controller.abrir));
router.patch('/:id/cerrar', requierePermiso('caja.cerrar'), asyncHandler(controller.cerrar));
// Sin requierePermiso: el permiso (caja.ingreso vs caja.retiro) depende del `tipo` en el body,
// se resuelve dentro del controller.
router.post('/:id/movimientos', asyncHandler(controller.registrarMovimiento));

module.exports = router;
