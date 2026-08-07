const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');

async function listar({ empresaId }) {
  return prisma.descuento.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } });
}

async function crear({ empresaId, usuarioEjecutorId, datos }) {
  return prisma.$transaction(async (tx) => {
    const descuento = await tx.descuento.create({ data: { empresaId, ...datos } });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'CREAR',
      entidad: 'Descuento',
      entidadId: descuento.id,
      valoresDespues: toJson(descuento),
    });
    return descuento;
  });
}

async function actualizar({ empresaId, usuarioEjecutorId, descuentoId, datos }) {
  const descuento = await prisma.descuento.findFirst({ where: { id: descuentoId, empresaId } });
  if (!descuento) throw new AppError(404, 'Descuento no encontrado.');

  return prisma.$transaction(async (tx) => {
    const actualizado = await tx.descuento.update({ where: { id: descuentoId }, data: datos });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Descuento',
      entidadId: descuentoId,
      valoresAntes: toJson(descuento),
      valoresDespues: toJson(actualizado),
    });
    return actualizado;
  });
}

async function eliminar({ empresaId, usuarioEjecutorId, descuentoId }) {
  const descuento = await prisma.descuento.findFirst({ where: { id: descuentoId, empresaId } });
  if (!descuento) throw new AppError(404, 'Descuento no encontrado.');

  const usos = await prisma.ventaDetalle.count({ where: { descuentoId } });
  if (usos > 0) {
    throw new AppError(409, 'No se puede eliminar: ya se aplicó en ventas. Desactívalo en su lugar.');
  }

  return prisma.$transaction(async (tx) => {
    await tx.descuento.delete({ where: { id: descuentoId } });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ELIMINAR',
      entidad: 'Descuento',
      entidadId: descuentoId,
      valoresAntes: toJson(descuento),
    });
  });
}

module.exports = { listar, crear, actualizar, eliminar };
