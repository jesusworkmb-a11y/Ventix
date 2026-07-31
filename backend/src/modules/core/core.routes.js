const express = require('express');

// MOD-001 Core -- Fase 1: auth, empresas, sucursales, usuarios, roles, permisos, folios, auditoria
// Placeholder: este router se implementa en su fase correspondiente del plan de trabajo.
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ modulo: 'core', estado: 'pendiente de implementacion' });
});

module.exports = router;
