const express = require('express');

// MOD-006 Inventario -- Fase 4: existencias, Kardex, ajustes, conteos, transferencias
// Placeholder: este router se implementa en su fase correspondiente del plan de trabajo.
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ modulo: 'inventario', estado: 'pendiente de implementacion' });
});

module.exports = router;
