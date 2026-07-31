const prisma = require('../../config/db');

// El override individual (PermisoUsuarioExcepcion) gana sobre el rol (§7.4).
async function usuarioTienePermiso({ usuarioId, rolId, clave }) {
  const permiso = await prisma.permiso.findUnique({ where: { clave } });
  if (!permiso) return false;

  const excepcion = await prisma.permisoUsuarioExcepcion.findUnique({
    where: { usuarioId_permisoId: { usuarioId, permisoId: permiso.id } },
  });
  if (excepcion) return excepcion.concedido;

  const rolPermiso = await prisma.rolPermiso.findUnique({
    where: { rolId_permisoId: { rolId, permisoId: permiso.id } },
  });
  return Boolean(rolPermiso);
}

// Permisos efectivos en vivo (rol + excepciones aplicadas) — usado por GET /me para hints de UI.
async function resolverPermisosDeUsuario({ usuarioId, rolId }) {
  const [rolPermisos, excepciones] = await Promise.all([
    prisma.rolPermiso.findMany({ where: { rolId }, include: { permiso: true } }),
    prisma.permisoUsuarioExcepcion.findMany({ where: { usuarioId }, include: { permiso: true } }),
  ]);

  const claves = new Set(rolPermisos.map((rp) => rp.permiso.clave));
  for (const excepcion of excepciones) {
    if (excepcion.concedido) claves.add(excepcion.permiso.clave);
    else claves.delete(excepcion.permiso.clave);
  }
  return [...claves];
}

module.exports = { usuarioTienePermiso, resolverPermisosDeUsuario };
