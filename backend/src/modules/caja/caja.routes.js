const express = require('express');

// MOD-007 Caja -- Fase 6
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const cajasRoutes = require('./cajas/cajas.routes');
const sesionesRoutes = require('./sesiones/sesiones.routes');

const router = express.Router();

router.use('/cajas', cajasRoutes);
router.use('/sesiones', sesionesRoutes);

module.exports = router;
