const express = require('express');
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const controller = require('./auth.controller');

const router = express.Router();

// /registro y /login son, junto con /facturacion/portal-publico, los únicos puntos sin
// autenticar del backend -- el bloqueo de cuenta en auth.service.js (5 intentos) no protege
// contra fuerza bruta distribuida (muchas cuentas distintas desde una misma IP) ni contra abuso
// de /registro, de ahí el rate-limit por IP acá (mismo patrón que
// facturacion.routes.js/limitarPortalPublico).
const limitarAuth = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
});

router.post('/registro', limitarAuth, asyncHandler(controller.registro));
router.post('/login', limitarAuth, asyncHandler(controller.login));
router.post('/recuperar', limitarAuth, asyncHandler(controller.recuperar));
router.post('/restablecer', limitarAuth, asyncHandler(controller.restablecer));
router.get('/me', auth, asyncHandler(controller.me));

module.exports = router;
