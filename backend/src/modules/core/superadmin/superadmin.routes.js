const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requiereSuperAdmin = require('../../../middlewares/superadmin.middleware');
const controller = require('./superadmin.controller');

const router = express.Router();
router.use(auth, requiereSuperAdmin);

router.get('/empresas', asyncHandler(controller.listarEmpresas));
router.patch('/empresas/:id/estado', asyncHandler(controller.cambiarEstadoEmpresa));
router.patch('/empresas/:id/vigencia', asyncHandler(controller.actualizarVigenciaEmpresa));
router.patch('/empresas/:id/plan', asyncHandler(controller.actualizarPlanEmpresa));
router.get('/respaldo', asyncHandler(controller.descargarRespaldoCompleto));
router.get('/empresas/:id/respaldo', asyncHandler(controller.descargarRespaldoEmpresa));

module.exports = router;
