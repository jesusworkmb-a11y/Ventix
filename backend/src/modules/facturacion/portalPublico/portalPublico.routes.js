const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const controller = require('./portalPublico.controller');
const catalogosSatPublicRoutes = require('../catalogosSat/catalogosSat.publicRoutes');

// Portal público de autofacturación (Fase E) -- a diferencia de sus hermanos (catalogosSat,
// facturas, plantillas) este router NUNCA pasa por `auth`: el cliente factura su propio ticket
// sin login. El rate-limit se aplica en facturacion.routes.js, sobre todo este mount, no acá.
const router = express.Router();

router.use('/catalogos-sat', catalogosSatPublicRoutes);
router.get('/:slug', asyncHandler(controller.obtenerEmpresa));
router.post('/:slug/buscar-venta', asyncHandler(controller.buscarVenta));
router.post('/:slug/facturar', asyncHandler(controller.facturar));

module.exports = router;
