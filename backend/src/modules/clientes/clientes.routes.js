const express = require('express');

// MOD-003 Clientes -- Fase 3
// Placeholder: este router se implementa en su fase correspondiente del plan de trabajo.
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ modulo: 'clientes', estado: 'pendiente de implementacion' });
});

module.exports = router;
