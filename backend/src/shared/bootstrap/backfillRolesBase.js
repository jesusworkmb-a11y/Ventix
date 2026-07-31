const prisma = require('../../config/db');
const { ROL_PERMISOS_DEFAULT } = require('../permisos.catalog');

const NOMBRES_ROLES_BASE = Object.keys(ROL_PERMISOS_DEFAULT);

// Cuando un módulo nuevo agrega permisos, los roles base de las empresas YA EXISTENTES
// (creados en su momento con un snapshot fijo de RolPermiso) no los ganan solos. Esto
// converge esos roles hacia ROL_PERMISOS_DEFAULT en cada arranque: puramente aditivo
// (nunca revoca), así Administrador siempre termina con todo. Se corre después de
// seedPermisos() para que los Permiso ya existan.
async function backfillRolesBase() {
  const permisos = await prisma.permiso.findMany();
  const permisoIdPorClave = new Map(permisos.map((p) => [p.clave, p.id]));

  const roles = await prisma.rol.findMany({
    where: { nombre: { in: NOMBRES_ROLES_BASE } },
    include: { permisos: true },
  });

  const filasFaltantes = [];
  for (const rol of roles) {
    const clavesEsperadas = ROL_PERMISOS_DEFAULT[rol.nombre] || [];
    const permisoIdsActuales = new Set(rol.permisos.map((rp) => rp.permisoId));
    for (const clave of clavesEsperadas) {
      const permisoId = permisoIdPorClave.get(clave);
      if (permisoId && !permisoIdsActuales.has(permisoId)) {
        filasFaltantes.push({ rolId: rol.id, permisoId });
      }
    }
  }

  if (filasFaltantes.length) {
    await prisma.rolPermiso.createMany({ data: filasFaltantes, skipDuplicates: true });
  }
}

module.exports = backfillRolesBase;
