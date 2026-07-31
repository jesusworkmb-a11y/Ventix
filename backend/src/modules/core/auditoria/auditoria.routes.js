const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./auditoria.controller');

const router = express.Router();
router.use(auth);
router.get('/', requierePermiso('administracion.auditoria.ver'), asyncHandler(controller.listar));

module.exports = router;
