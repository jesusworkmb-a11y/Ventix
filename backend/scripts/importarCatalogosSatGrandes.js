// Carga (o actualiza) los dos catálogos SAT grandes que seedCatalogosSat.js deja pendientes:
// ClaveProdServ (~52,500 claves) y ClaveUnidad (~2,400 claves) — demasiado grandes para
// mantener a mano en catalogosSat.data.js.
//
// Fuente: espejo comunitario (bambucode/catalogos_sat_JSON en GitHub) que convierte a JSON
// los archivos oficiales que publica el SAT en el Anexo 20 (c_ClaveProdServ / c_ClaveUnidad).
// No se versionan esos JSON en este repo por su tamaño (~18MB + ~0.6MB) — este script los
// descarga en el momento.
//
// Uso manual, no corre en el bootstrap del server (a diferencia de seedCatalogosSat.js):
//   npm run importar:catalogos-sat
// Es seguro re-correrlo cuando el SAT actualice el catálogo -- createMany + skipDuplicates
// sobre @@unique([tipo, clave]) es insert-only, nunca pisa una fila ya sembrada. Si el SAT
// da de baja una clave (fechaFinVigencia) se re-importa igual pero con activo:false, para
// que buscar() (que filtra activo:true) deje de ofrecerla sin borrar el historial.

const prisma = require('../src/config/db');

const FUENTES = {
  ClaveProdServ: {
    url: 'https://raw.githubusercontent.com/bambucode/catalogos_sat_JSON/master/c_ClaveProdServ.json',
    mapear: (e) => ({
      tipo: 'ClaveProdServ',
      clave: e.id,
      descripcion: e.descripcion,
      activo: !e.fechaFinVigencia,
    }),
  },
  ClaveUnidad: {
    url: 'https://raw.githubusercontent.com/bambucode/catalogos_sat_JSON/master/c_ClaveUnidad.json',
    mapear: (e) => ({
      tipo: 'ClaveUnidad',
      clave: e.id,
      descripcion: e.nombre || e.descripcion || e.id,
      activo: !e.fechaDeFinDeVigencia,
    }),
  },
};

const TAMANO_LOTE = 2000;

async function importarCatalogo(tipo, { url, mapear }) {
  console.log(`[${tipo}] descargando ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[${tipo}] descarga falló: HTTP ${res.status}`);
  const entradas = await res.json();
  const filas = entradas.map(mapear).filter((f) => f.clave);
  console.log(`[${tipo}] ${filas.length} claves (de ${entradas.length} entradas crudas), importando en lotes de ${TAMANO_LOTE}...`);

  let insertadas = 0;
  for (let i = 0; i < filas.length; i += TAMANO_LOTE) {
    const lote = filas.slice(i, i + TAMANO_LOTE);
    const resultado = await prisma.catalogoSat.createMany({ data: lote, skipDuplicates: true });
    insertadas += resultado.count;
    process.stdout.write(`\r[${tipo}] ${Math.min(i + TAMANO_LOTE, filas.length)}/${filas.length} procesadas, ${insertadas} nuevas`);
  }
  console.log('');

  const activas = filas.filter((f) => f.activo).length;
  console.log(`[${tipo}] listo: ${insertadas} filas nuevas insertadas, ${activas} vigentes de ${filas.length} totales.`);
}

async function main() {
  for (const [tipo, fuente] of Object.entries(FUENTES)) {
    await importarCatalogo(tipo, fuente);
  }
}

main()
  .catch((err) => {
    console.error('Error importando catálogos SAT:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
