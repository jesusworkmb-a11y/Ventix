const prisma = require('../../config/db');
const { PERMISOS_DEFAULT } = require('../permisos.catalog');

// Se corre al arrancar el servidor (no como paso de deploy aparte, fácil de olvidar en Render).
// Insert-only e idempotente: createMany + skipDuplicates evita condiciones de carrera entre
// reinicios concurrentes; el catálogo no es editable por el usuario en Fase 1.
async function seedPermisos() {
  await prisma.permiso.createMany({ data: PERMISOS_DEFAULT, skipDuplicates: true });
}

module.exports = seedPermisos;
