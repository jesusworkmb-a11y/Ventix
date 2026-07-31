const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');

async function listar({ empresaId }) {
  return prisma.listaPrecio.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } });
}

async function crear({ empresaId, usuarioEjecutorId, datos }) {
  return prisma.$transaction(async (tx) => {
    const listaPrecio = await tx.listaPrecio.create({ data: { empresaId, ...datos } });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'CREAR',
      entidad: 'ListaPrecio',
      entidadId: listaPrecio.id,
      valoresDespues: toJson(listaPrecio),
    });
    return listaPrecio;
  });
}

async function actualizar({ empresaId, usuarioEjecutorId, listaPrecioId, datos }) {
  const listaPrecio = await prisma.listaPrecio.findFirst({ where: { id: listaPrecioId, empresaId } });
  if (!listaPrecio) throw new AppError(404, 'Lista de precio no encontrada.');

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.listaPrecio.update({ where: { id: listaPrecioId }, data: datos });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'ListaPrecio',
      entidadId: listaPrecioId,
      valoresAntes: toJson(listaPrecio),
      valoresDespues: toJson(actualizada),
    });
    return actualizada;
  });
}

module.exports = { listar, crear, actualizar };
