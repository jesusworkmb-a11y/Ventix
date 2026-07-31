const prisma = require('../../config/db');
const AppError = require('../../shared/errors/AppError');
const { registrarAuditoria } = require('../../shared/services/auditoria.service');
const toJson = require('../../shared/toJson');

async function listar({ empresaId, filtros }) {
  const where = { empresaId };
  if (filtros.activo !== undefined) where.activo = filtros.activo;
  if (filtros.buscar) {
    where.OR = [
      { nombre: { contains: filtros.buscar, mode: 'insensitive' } },
      { correo: { contains: filtros.buscar, mode: 'insensitive' } },
      { telefono: { contains: filtros.buscar, mode: 'insensitive' } },
      { rfc: { contains: filtros.buscar, mode: 'insensitive' } },
    ];
  }
  return prisma.proveedor.findMany({ where, orderBy: { nombre: 'asc' } });
}

async function obtener({ empresaId, proveedorId }) {
  const proveedor = await prisma.proveedor.findFirst({ where: { id: proveedorId, empresaId } });
  if (!proveedor) throw new AppError(404, 'Proveedor no encontrado.');
  return proveedor;
}

async function crear({ empresaId, usuarioEjecutorId, datos }) {
  return prisma.$transaction(async (tx) => {
    const proveedor = await tx.proveedor.create({ data: { empresaId, ...datos } });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'CREAR',
      entidad: 'Proveedor',
      entidadId: proveedor.id,
      valoresDespues: toJson(proveedor),
    });
    return proveedor;
  });
}

async function actualizar({ empresaId, usuarioEjecutorId, proveedorId, datos }) {
  const proveedor = await prisma.proveedor.findFirst({ where: { id: proveedorId, empresaId } });
  if (!proveedor) throw new AppError(404, 'Proveedor no encontrado.');

  return prisma.$transaction(async (tx) => {
    const actualizado = await tx.proveedor.update({ where: { id: proveedorId }, data: datos });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Proveedor',
      entidadId: proveedorId,
      valoresAntes: toJson(proveedor),
      valoresDespues: toJson(actualizado),
    });
    return actualizado;
  });
}

module.exports = { listar, obtener, crear, actualizar };
