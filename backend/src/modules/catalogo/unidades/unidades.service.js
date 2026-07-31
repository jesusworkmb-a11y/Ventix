const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');

async function listar({ empresaId }) {
  return prisma.unidad.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } });
}

async function crear({ empresaId, usuarioEjecutorId, datos }) {
  return prisma.$transaction(async (tx) => {
    const unidad = await tx.unidad.create({ data: { empresaId, ...datos } });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'CREAR',
      entidad: 'Unidad',
      entidadId: unidad.id,
      valoresDespues: toJson(unidad),
    });
    return unidad;
  });
}

async function actualizar({ empresaId, usuarioEjecutorId, unidadId, datos }) {
  const unidad = await prisma.unidad.findFirst({ where: { id: unidadId, empresaId } });
  if (!unidad) throw new AppError(404, 'Unidad no encontrada.');

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.unidad.update({ where: { id: unidadId }, data: datos });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Unidad',
      entidadId: unidadId,
      valoresAntes: toJson(unidad),
      valoresDespues: toJson(actualizada),
    });
    return actualizada;
  });
}

module.exports = { listar, crear, actualizar };
