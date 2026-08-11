const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./atributos.controller');

const router = express.Router();
router.use(auth);

router.get('/', asyncHandler(controller.listar));
router.post('/', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.crear));
router.patch('/:id', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.actualizar));
router.delete('/:id', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.eliminar));

router.post('/:id/valores', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.agregarValor));
router.patch('/valores/:valorId', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.actualizarValor));
router.delete('/valores/:valorId', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.eliminarValor));

module.exports = router;
