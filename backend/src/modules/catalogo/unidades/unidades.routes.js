const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./unidades.controller');

const router = express.Router();
router.use(auth);

router.get('/', asyncHandler(controller.listar));
router.post('/', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.crear));
router.patch('/:id', requierePermiso('catalogo.configuracion.gestionar'), asyncHandler(controller.actualizar));

module.exports = router;
