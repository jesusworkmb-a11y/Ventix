const express = require('express');
const prisma = require('../config/db');

const router = express.Router();

// Health check end-to-end: confirma que Express responde y que hay conexión real a PostgreSQL.
// Es el criterio de salida de la Fase 0 (ver plan de trabajo).
router.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: error.message });
  }
});

module.exports = router;
