const prisma = require('../../../config/db');
const { parsePaginacion, parseOrden, respuestaPaginada } = require('../../../shared/paginacion');

const COLUMNAS_ORDENABLES = {
  creadoEn: 'creadoEn',
  accion: 'accion',
  entidad: 'entidad',
  folio: 'folio',
};

// Retención máxima de la bitácora: 1 mes. Sin cron confiable en este entorno (el backend duerme
// por inactividad en Render free tier), así que se purga "al vuelo" cada vez que alguien de la
// empresa abre su propia Auditoría, en vez de un job programado — mismo criterio ya usado para
// vigenciaHasta. Baja frecuencia de acceso a esta pantalla = no compite con las rutas de negocio.
const RETENCION_DIAS = 30;

async function purgarAntiguos(empresaId) {
  const limite = new Date(Date.now() - RETENCION_DIAS * 24 * 60 * 60 * 1000);
  await prisma.auditoria.deleteMany({ where: { empresaId, creadoEn: { lt: limite } } });
}

async function listar({ empresaId, filtros, paginacion, ordenamiento }) {
  await purgarAntiguos(empresaId);

  // Las acciones que el superadmin de la plataforma realiza sobre la empresa (estado, vigencia,
  // plan) se auditan igual para trazabilidad interna, pero no le pertenecen a la empresa ni a
  // ninguno de sus usuarios — no deben aparecer en su propia bitácora.
  const where = { empresaId, esAccionPlataforma: false };
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
