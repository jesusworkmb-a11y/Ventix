const express = require('express');

// MOD-FACTURACION -- Fase B: solo catálogos SAT (lectura). Facturas/portal público se agregan
// en fases posteriores del roadmap. No agregar endpoints de otros módulos acá (regla de
// límites de módulo, §3.1).
const catalogosSatRoutes = require('./catalogosSat/catalogosSat.routes');

const router = express.Router();

router.use('/catalogos-sat', catalogosSatRoutes);

module.exports = router;
