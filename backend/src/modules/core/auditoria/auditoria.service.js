const prisma = require('../../../config/db');
const { parsePaginacion, parseOrden, respuestaPaginada } = require('../../../shared/paginacion');

const COLUMNAS_ORDENABLES = {
  creadoEn: 'creadoEn',
  accion: 'accion',
  entidad: 'entidad',
  folio: 'folio',
};

async function listar({ empresaId, filtros, paginacion, ordenamiento }) {
  const where = { empresaId };
  if (filtros.entidad) where.entidad = filtros.entidad;
  if (filtros.entidadId) where.entidadId = filtros.entidadId;
  if (filtros.usuarioEjecutorId) where.usuarioEjecutorId = filtros.usuarioEjecutorId;
  if (filtros.desde || filtros.hasta) {
    where.creadoEn = {};
    if (filtros.desde) where.creadoEn.gte = new Date(filtros.desde);
    if (filtros.hasta) where.creadoEn.lte = new Date(filtros.hasta);
  }
  if (filtros.buscar) {
    where.folio = { contains: filtros.buscar, mode: 'insensitive' };
  }

  const paginado = parsePaginacion(paginacion);
  const orderBy = parseOrden(ordenamiento || {}, COLUMNAS_ORDENABLES, { creadoEn: 'desc' });

  const [datos, total] = await Promise.all([
    prisma.auditoria.findMany({ where, orderBy, skip: paginado.skip, take: paginado.take }),
    prisma.auditoria.count({ where }),
  ]);

  return respuestaPaginada(datos, total, paginado);
}

module.exports = { listar };
