const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./usuarios.controller');

const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('administracion.usuarios.ver'), asyncHandler(controller.listar));
router.post('/', requierePermiso('administracion.usuarios.crear'), asyncHandler(controller.crear));
router.patch('/:id', requierePermiso('administracion.usuarios.editar'), asyncHandler(controller.actualizar));

module.exports = router;
