const prisma = require('../../config/db');
const { CATALOGOS_SAT_CHICOS } = require('../catalogosSat.data');

// Mismo criterio que seedPermisos: corre al arrancar el servidor, insert-only e
// idempotente (createMany + skipDuplicates sobre @@unique([tipo, clave])), así que
// reiniciar el servidor nunca duplica ni pisa filas ya sembradas.
//
// ClaveProdServ/ClaveUnidad (los catálogos grandes) NO se siembran acá — quedan
// pendientes de una carga aparte desde los archivos oficiales del SAT.
async function seedCatalogosSat() {
  const filas = Object.entries(CATALOGOS_SAT_CHICOS).flatMap(([tipo, entradas]) =>
    entradas.map((entrada) => ({ tipo, clave: entrada.clave, descripcion: entrada.descripcion })),
  );

  await prisma.catalogoSat.createMany({ data: filas, skipDuplicates: true });
}

module.exports = seedCatalogosSat;
