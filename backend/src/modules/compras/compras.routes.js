const express = require('express');

// MOD-005 Compras -- Fase 5
// Placeholder: este router se implementa en su fase correspondiente del plan de trabajo.
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ modulo: 'compras', estado: 'pendiente de implementacion' });
});

module.exports = router;
