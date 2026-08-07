const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');

async function listar({ empresaId }) {
  return prisma.promocion.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } });
}

async function crear({ empresaId, usuarioEjecutorId, datos }) {
  return prisma.$transaction(async (tx) => {
    const promocion = await tx.promocion.create({ data: { empresaId, ...datos } });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'CREAR',
      entidad: 'Promocion',
      entidadId: promocion.id,
      valoresDespues: toJson(promocion),
    });
    return promocion;
  });
}

async function actualizar({ empresaId, usuarioEjecutorId, promocionId, datos }) {
  const promocion = await prisma.promocion.findFirst({ where: { id: promocionId, empresaId } });
  if (!promocion) throw new AppError(404, 'Promoción no encontrada.');

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.promocion.update({ where: { id: promocionId }, data: datos });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Promocion',
      entidadId: promocionId,
      valoresAntes: toJson(promocion),
      valoresDespues: toJson(actualizada),
    });
    return actualizada;
  });
}

module.exports = { listar, crear, actualizar };
