const express = require('express');

// MOD-006 Inventario -- Fase 4: existencias, Kardex, ajustes, conteos, transferencias
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const existenciasRoutes = require('./existencias/existencias.routes');
const movimientosRoutes = require('./movimientos/movimientos.routes');
const ajustesRoutes = require('./ajustes/ajustes.routes');
const conteosRoutes = require('./conteos/conteos.routes');
const transferenciasRoutes = require('./transferencias/transferencias.routes');

const router = express.Router();

router.use('/existencias', existenciasRoutes);
router.use('/movimientos', movimientosRoutes);
router.use('/ajustes', ajustesRoutes);
router.use('/conteos', conteosRoutes);
router.use('/transferencias', transferenciasRoutes);

module.exports = router;
