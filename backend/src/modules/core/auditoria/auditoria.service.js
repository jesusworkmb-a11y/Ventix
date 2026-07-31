const prisma = require('../../../config/db');

async function listar({ empresaId, filtros }) {
  const where = { empresaId };
  if (filtros.entidad) where.entidad = filtros.entidad;
  if (filtros.entidadId) where.entidadId = filtros.entidadId;
  if (filtros.usuarioEjecutorId) where.usuarioEjecutorId = filtros.usuarioEjecutorId;
  if (filtros.desde || filtros.hasta) {
    where.creadoEn = {};
    if (filtros.desde) where.creadoEn.gte = new Date(filtros.desde);
    if (filtros.hasta) where.creadoEn.lte = new Date(filtros.hasta);
  }

  return prisma.auditoria.findMany({ where, orderBy: { creadoEn: 'desc' }, take: 200 });
}

module.exports = { listar };
