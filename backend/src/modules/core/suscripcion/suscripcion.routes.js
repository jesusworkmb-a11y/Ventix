const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./suscripcion.controller');

const router = express.Router();

// Público (lo llama Mercado Pago): va ANTES de router.use(auth). No confía en su contenido — solo
// toma el id del pago y lo re-consulta a la API de MP con nuestro access token.
router.post('/webhook', asyncHandler(controller.webhook));

router.use(auth);
// Mismo permiso que editar la empresa: quien administra la empresa es quien paga. Estas rutas
// siguen accesibles con la vigencia vencida (ver RUTAS_CON_VIGENCIA_VENCIDA en auth.middleware).
const soloAdmin = requierePermiso('administracion.empresa.editar');
router.get('/', soloAdmin, asyncHandler(controller.obtenerResumen));
router.post('/checkout', soloAdmin, asyncHandler(controller.iniciarCheckout));
router.get('/pagos/:id', soloAdmin, asyncHandler(controller.obtenerPago));

module.exports = router;
