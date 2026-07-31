const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');

async function listar({ empresaId }) {
  return prisma.marca.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } });
}

async function crear({ empresaId, usuarioEjecutorId, nombre }) {
  return prisma.$transaction(async (tx) => {
    const marca = await tx.marca.create({ data: { empresaId, nombre } });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'CREAR',
      entidad: 'Marca',
      entidadId: marca.id,
      valoresDespues: toJson(marca),
    });
    return marca;
  });
}

async function actualizar({ empresaId, usuarioEjecutorId, marcaId, nombre }) {
  const marca = await prisma.marca.findFirst({ where: { id: marcaId, empresaId } });
  if (!marca) throw new AppError(404, 'Marca no encontrada.');

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.marca.update({ where: { id: marcaId }, data: { nombre } });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Marca',
      entidadId: marcaId,
      valoresAntes: toJson(marca),
      valoresDespues: toJson(actualizada),
    });
    return actualizada;
  });
}

module.exports = { listar, crear, actualizar };
