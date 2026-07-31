const express = require('express');

// MOD-010 Herramientas (Importacion/Exportacion) -- Fase 10
// Placeholder: este router se implementa en su fase correspondiente del plan de trabajo.
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ modulo: 'herramientas', estado: 'pendiente de implementacion' });
});

module.exports = router;
