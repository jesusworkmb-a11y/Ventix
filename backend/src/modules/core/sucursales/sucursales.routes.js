const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./sucursales.controller');

const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('administracion.sucursales.ver'), asyncHandler(controller.listar));
router.post('/', requierePermiso('administracion.sucursales.gestionar'), asyncHandler(controller.crear));
router.patch('/:id', requierePermiso('administracion.sucursales.gestionar'), asyncHandler(controller.actualizar));
router.patch(
  '/:id/fiscal',
  requierePermiso('administracion.fiscal.editar'),
  asyncHandler(controller.actualizarFiscal),
);

module.exports = router;
