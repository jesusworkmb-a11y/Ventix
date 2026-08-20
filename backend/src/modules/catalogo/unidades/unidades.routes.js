const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./unidades.controller');

const router = express.Router();
router.use(auth);

// Falta detectada en QA pre-lanzamiento: este GET no tenía ningún requierePermiso (solo auth).
// Mismo criterio que descuentos/promociones/categorías/marcas: catalogo.articulos.ver.
router.get('/', requierePermiso('catalogo.articulos.ver'), asyncHandler(controller.listar));
router.post('/', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.crear));
router.patch('/:id', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.actualizar));

module.exports = router;
