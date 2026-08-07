const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./promociones.controller');

const router = express.Router();
router.use(auth);

// Mismo criterio que descuentos.routes.js: GET abierto a quien pueda ver el catálogo
// (Cajero incluido), alta/edición reservada a quien gestiona el catálogo.
router.get('/', requierePermiso('catalogo.articulos.ver'), asyncHandler(controller.listar));
router.post('/', requierePermiso('catalogo.descuentos.gestionar'), asyncHandler(controller.crear));
router.patch('/:id', requierePermiso('catalogo.descuentos.gestionar'), asyncHandler(controller.actualizar));
router.delete('/:id', requierePermiso('catalogo.descuentos.gestionar'), asyncHandler(controller.eliminar));

module.exports = router;
