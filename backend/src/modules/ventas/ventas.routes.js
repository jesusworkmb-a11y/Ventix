const express = require('express');

// MOD-008 Ventas -- Fase 7 (nucleo del POS)
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const ventasRoutes = require('./ventas/ventas.routes');
const devolucionesRoutes = require('./devoluciones/devoluciones.routes');
const cotizacionesRoutes = require('./cotizaciones/cotizaciones.routes');

const router = express.Router();

router.use('/ventas', ventasRoutes);
router.use('/devoluciones', devolucionesRoutes);
router.use('/cotizaciones', cotizacionesRoutes);

module.exports = router;
