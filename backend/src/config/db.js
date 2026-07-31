// Fuente única del cliente Prisma. Ningún módulo debe instanciar su propio PrismaClient
// (evita agotar conexiones y mantiene una sola fuente de acceso a datos, §3.2).
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

module.exports = prisma;
