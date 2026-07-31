const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');

async function listar({ empresaId, filtros }) {
  const where = { empresaId };
  if (filtros.sucursalId) where.sucursalId = filtros.sucursalId;
  return prisma.caja.findMany({ where, orderBy: { nombre: 'asc' } });
}

async function crear({ empresaId, usuarioEjecutorId, sucursalId, nombre }) {
  const sucursal = await prisma.sucursal.findFirst({ where: { id: sucursalId, empresaId } });
  if (!sucursal) throw new AppError(400, 'La sucursal indicada no pertenece a esta empresa.');

  return prisma.$transaction(async (tx) => {
    const caja = await tx.caja.create({ data: { empresaId, sucursalId, nombre } });
    await registrarAuditoria(tx, {
      empresaId,
      sucursalId,
      usuarioEjecutorId,
      accion: 'CREAR',
      entidad: 'Caja',
      entidadId: caja.id,
      valoresDespues: toJson(caja),
    });
    return caja;
  });
}

async function actualizar({ empresaId, usuarioEjecutorId, cajaId, datos }) {
  const caja = await prisma.caja.findFirst({ where: { id: cajaId, empresaId } });
  if (!caja) throw new AppError(404, 'Caja no encontrada.');

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.caja.update({ where: { id: cajaId }, data: datos });
    await registrarAuditoria(tx, {
      empresaId,
      sucursalId: caja.sucursalId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Caja',
      entidadId: cajaId,
      valoresAntes: toJson(caja),
      valoresDespues: toJson(actualizada),
    });
    return actualizada;
  });
}

module.exports = { listar, crear, actualizar };
