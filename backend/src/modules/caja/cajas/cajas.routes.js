const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./cajas.controller');

const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('caja.ver'), asyncHandler(controller.listar));
router.post('/', requierePermiso('caja.gestionar'), asyncHandler(controller.crear));
router.patch('/:id', requierePermiso('caja.gestionar'), asyncHandler(controller.actualizar));

module.exports = router;
