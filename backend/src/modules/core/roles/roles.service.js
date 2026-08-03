const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');

async function listar({ empresaId }) {
  const roles = await prisma.rol.findMany({
    where: { empresaId },
    include: { permisos: { include: { permiso: true } } },
    orderBy: { nombre: 'asc' },
  });
  return roles.map((rol) => ({
    id: rol.id,
    nombre: rol.nombre,
    permisos: rol.permisos.map((rp) => rp.permiso.clave),
  }));
}

async function crear({ empresaId, usuarioEjecutorId, nombre }) {
  const existente = await prisma.rol.findUnique({ where: { empresaId_nombre: { empresaId, nombre } } });
  if (existente) throw new AppError(409, 'Ya existe un rol con ese nombre.');

  return prisma.$transaction(async (tx) => {
    const rol = await tx.rol.create({ data: { empresaId, nombre } });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'CREAR',
      entidad: 'Rol',
      entidadId: rol.id,
      valoresDespues: toJson(rol),
    });
    return rol;
  });
}

async function actualizar({ empresaId, usuarioEjecutorId, rolId, nombre }) {
  const rol = await prisma.rol.findFirst({ where: { id: rolId, empresaId } });
  if (!rol) throw new AppError(404, 'Rol no encontrado.');

  return prisma.$transaction(async (tx) => {
    const actualizado = await tx.rol.update({ where: { id: rolId }, data: { nombre } });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Rol',
      entidadId: rolId,
      valoresAntes: toJson({ nombre: rol.nombre }),
      valoresDespues: toJson({ nombre: actualizado.nombre }),
    });
    return actualizado;
  });
}

async function reemplazarPermisos({ empresaId, usuarioEjecutorId, rolId, claves }) {
  const rol = await prisma.rol.findFirst({ where: { id: rolId, empresaId } });
  if (!rol) throw new AppError(404, 'Rol no encontrado.');

  const clavesUnicas = [...new Set(claves)];
  const permisos = await prisma.permiso.findMany({ where: { clave: { in: clavesUnicas } } });
  if (permisos.length !== clavesUnicas.length) throw new AppError(400, 'Alguna clave de permiso no existe.');

  return prisma.$transaction(async (tx) => {
    const anteriores = await tx.rolPermiso.findMany({ where: { rolId }, include: { permiso: true } });
    await tx.rolPermiso.deleteMany({ where: { rolId } });
    if (permisos.length) {
      await tx.rolPermiso.createMany({ data: permisos.map((p) => ({ rolId, permisoId: p.id })) });
    }

    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'RolPermiso',
      entidadId: rolId,
      valoresAntes: toJson(anteriores.map((a) => a.permiso.clave)),
      valoresDespues: toJson(clavesUnicas),
    });

    return clavesUnicas;
  });
}

module.exports = { listar, crear, actualizar, reemplazarPermisos };
