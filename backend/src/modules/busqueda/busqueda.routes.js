const express = require('express');

// Buscador global de la barra superior. No exige un permiso único: cada categoría se
// filtra por su propio permiso de "ver" dentro de busqueda.service.js (regla de límites de
// módulo, §3.1 — no importa modelos de otros módulos salvo lectura acá).
const asyncHandler = require('../../shared/asyncHandler');
const auth = require('../../middlewares/auth.middleware');
const controller = require('./busqueda.controller');

const router = express.Router();
router.use(auth);

router.get('/', asyncHandler(controller.buscar));

module.exports = router;
