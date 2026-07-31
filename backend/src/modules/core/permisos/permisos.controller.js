const prisma = require('../../../config/db');

async function listar(req, res) {
  const permisos = await prisma.permiso.findMany({ orderBy: [{ grupo: 'asc' }, { nombre: 'asc' }] });
  res.json(permisos);
}

module.exports = { listar };
