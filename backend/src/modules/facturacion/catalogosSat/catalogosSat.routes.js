const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const controller = require('./catalogosSat.controller');

// Solo lectura, sin permiso propio (mismo criterio que busqueda.routes.js) — cualquier usuario
// autenticado puede necesitar buscar un catálogo SAT (ej. un cajero facturando desde Ventas),
// no es información sensible.
const router = express.Router();
router.use(auth);

router.get('/', asyncHandler(controller.buscar));

module.exports = router;
