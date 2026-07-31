const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./listasPrecio.controller');

const router = express.Router();
router.use(auth);
router.use(requierePermiso('catalogo.precios.gestionar'));

router.get('/', asyncHandler(controller.listar));
router.post('/', asyncHandler(controller.crear));
router.patch('/:id', asyncHandler(controller.actualizar));

module.exports = router;
