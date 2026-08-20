const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./categorias.controller');

const router = express.Router();
router.use(auth);

// Falta detectada en QA pre-lanzamiento: este GET no tenía ningún requierePermiso (solo auth),
// así que cualquier usuario autenticado -- sin importar su rol -- podía listar categorías.
// Mismo criterio que descuentos/promociones: catalogo.articulos.ver, no
// catalogo.configuracion.gestionar, para no bloquear a roles que solo necesitan leer catálogo.
router.get('/', requierePermiso('catalogo.articulos.ver'), asyncHandler(controller.listar));
router.post('/', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.crear));
router.patch('/:id', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.actualizar));

module.exports = router;
