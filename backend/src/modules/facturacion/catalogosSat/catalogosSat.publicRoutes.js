const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const controller = require('./catalogosSat.controller');

// Variante sin auth del mismo buscador (catalogosSat.routes.js), para que el portal público de
// autofacturación (Fase E) pueda buscar Régimen Fiscal/Uso CFDI sin login. Mismo controller y
// service, cero lógica duplicada -- estos catálogos ya son de solo lectura y no filtran por
// empresaId (son iguales para todas las empresas), así que exponerlos sin auth no agrega
// superficie de datos sensibles.
const router = express.Router();

router.get('/', asyncHandler(controller.buscar));

module.exports = router;
