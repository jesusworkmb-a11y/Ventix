const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./atributos.controller');

const router = express.Router();
router.use(auth);

// Falta detectada en QA pre-lanzamiento: este GET no tenía ningún requierePermiso (solo auth).
// Mismo criterio que el resto de Catálogo: catalogo.articulos.ver.
router.get('/', requierePermiso('catalogo.articulos.ver'), asyncHandler(controller.listar));
router.post('/', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.crear));
router.patch('/:id', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.actualizar));
router.delete('/:id', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.eliminar));

router.post('/:id/valores', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.agregarValor));
router.patch('/valores/:valorId', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.actualizarValor));
router.delete('/valores/:valorId', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.eliminarValor));

module.exports = router;
