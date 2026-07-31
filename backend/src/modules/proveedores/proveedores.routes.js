const express = require('express');

// MOD-004 Proveedores -- Fase 3
// Placeholder: este router se implementa en su fase correspondiente del plan de trabajo.
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ modulo: 'proveedores', estado: 'pendiente de implementacion' });
});

module.exports = router;
