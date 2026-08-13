const express = require('express');

// MOD-FACTURACION -- Fase C agrega facturas (Directa/Venta POS/Global/Consolidada). El portal
// público de autofacturación se agrega en la Fase E del roadmap. No agregar endpoints de otros
// módulos acá (regla de límites de módulo, §3.1).
const catalogosSatRoutes = require('./catalogosSat/catalogosSat.routes');
const facturasRoutes = require('./facturas/facturas.routes');
const plantillasRoutes = require('./plantillas/plantillas.routes');

const router = express.Router();

router.use('/catalogos-sat', catalogosSatRoutes);
router.use('/facturas', facturasRoutes);
router.use('/plantillas', plantillasRoutes);

module.exports = router;
