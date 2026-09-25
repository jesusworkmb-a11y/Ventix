// Restaura un respaldo COMPLETO (descargado desde /superadmin) en una base VACÍA.
//
// Pensado para recuperación ante desastre: se crea una base nueva (otro proyecto de Supabase,
// o la misma tras recrearla), se le aplican las migraciones y aquí se cargan los datos. NO sirve
// para "regresar en el tiempo" una base en uso ni para restaurar una sola empresa encima de las
// demás -- la base es multi-tenant y eso podría pisar datos de otras empresas; por eso el
// script se niega a tocar una base que tenga cualquier fila.
//
// Uso (desde backend/):
//   1. Crear la base destino y un archivo .env con su DATABASE_URL (ej. .env.restaurar; usar la
//      conexión directa de Supabase, puerto 5432, no el pooler).
//   2. Aplicarle las migraciones, con el código en la misma versión que generó el respaldo:
//        PowerShell:  $env:DATABASE_URL="<url>"; npx prisma migrate deploy
//        Bash:        DATABASE_URL="<url>" npx prisma migrate deploy
//   3. node scripts/restaurarRespaldo.js <respaldo.ndjson.gz> --env=.env.restaurar             (simulación)
//   4. node scripts/restaurarRespaldo.js <respaldo.ndjson.gz> --env=.env.restaurar --confirmar (restaura)
//
// Para ensayarlo sin tocar nada: DATABASE_URL del sandbox + "?schema=respaldo_prueba" (un schema
// vacío dentro de la misma base), y al terminar DROP SCHEMA respaldo_prueba CASCADE.
//
// El archivo .env es obligatorio y explícito a propósito: nunca toma backend/.env por defecto,
// que apunta a producción.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');

const args = process.argv.slice(2);
const archivo = args.find((a) => !a.startsWith('--'));
const envArg = args.find((a) => a.startsWith('--env='));
const confirmar = args.includes('--confirmar');

if (!archivo || !envArg) {
  console.error('Uso: node scripts/restaurarRespaldo.js <respaldo.ndjson.gz> --env=<archivo .env de la base destino> [--confirmar]');
  process.exit(1);
}
const envPath = path.resolve(envArg.slice('--env='.length));
if (!fs.existsSync(envPath)) {
  console.error(`No existe el archivo ${envPath}.`);
  process.exit(1);
}
require('dotenv').config({ path: envPath, override: true });

const { PrismaClient, Prisma } = require('@prisma/client');
const { FORMATO, VERSION, MODELO_POR_NOMBRE, delegado, ordenInsercion, migracionActual } = require('../src/shared/respaldo');

async function* leerLineas(ruta) {
  const entrada = fs.createReadStream(ruta).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input: entrada, crlfDelay: Infinity });
  for await (const linea of rl) {
    if (linea.trim()) yield JSON.parse(linea);
  }
}

function hostDe(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || 5432}${u.pathname}${u.searchParams.get('schema') ? ` (schema ${u.searchParams.get('schema')})` : ''}`;
  } catch {
    return '(DATABASE_URL ilegible)';
  }
}

// Primera pasada: valida el archivo completo antes de tocar la base.
async function validarArchivo(ruta) {
  let encabezado = null;
  let fin = null;
  const conteos = {};
  for await (const obj of leerLineas(ruta)) {
    if (!encabezado) {
      encabezado = obj;
      if (obj.formato !== FORMATO) throw new Error('El archivo no es un respaldo de BOX POS.');
      if (obj.version !== VERSION) throw new Error(`Versión de respaldo ${obj.version} no soportada (se espera ${VERSION}).`);
      if (obj.tipo !== 'completo') {
        throw new Error('Solo se restauran respaldos completos. El respaldo por empresa es una exportación de datos (sin contraseñas ni catálogos SAT), no sirve para restaurar.');
      }
      continue;
    }
    if (obj.fin) { fin = obj; continue; }
    if (fin) throw new Error('Hay datos después de la línea final: archivo corrupto.');
    if (!MODELO_POR_NOMBRE[obj.tabla]) throw new Error(`Tabla desconocida en el respaldo: ${obj.tabla}. ¿El respaldo es de otra versión del esquema?`);
    conteos[obj.tabla] = (conteos[obj.tabla] || 0) + obj.filas.length;
  }
  if (!encabezado) throw new Error('El archivo está vacío.');
  if (!fin) throw new Error('El archivo está incompleto (falta la línea final): la descarga se cortó. Descarga el respaldo de nuevo.');
  for (const [tabla, n] of Object.entries(fin.conteos)) {
    if ((conteos[tabla] || 0) !== n) throw new Error(`La tabla ${tabla} trae ${conteos[tabla] || 0} filas pero el respaldo declara ${n}: archivo corrupto.`);
  }
  return { encabezado, conteos: fin.conteos };
}

// Prisma no acepta null plano en columnas Json dentro de createMany: hay que decir DbNull.
function prepararFilas(modelo, filas, pendientesAutorref) {
  const camposJson = modelo.fields.filter((f) => f.kind === 'scalar' && f.type === 'Json').map((f) => f.name);
  const camposAutorref = modelo.fields
    .filter((f) => f.kind === 'object' && f.type === modelo.name && f.relationFromFields?.length)
    .flatMap((f) => f.relationFromFields);

  return filas.map((fila) => {
    const copia = { ...fila };
    for (const c of camposJson) if (copia[c] === null) copia[c] = Prisma.DbNull;
    // Autorreferencias (categoría padre, artículo padre): el padre puede venir después del hijo
    // en el archivo, así que se inserta en null y se liga al terminar la tabla.
    for (const c of camposAutorref) {
      if (copia[c]) {
        pendientesAutorref.push({ campo: c, id: copia.id, padreId: copia[c] });
        copia[c] = null;
      }
    }
    return copia;
  });
}

async function ligarAutorreferencias(tx, modelo, pendientes) {
  const porPadre = new Map();
  for (const { campo, id, padreId } of pendientes) {
    const clave = `${campo}\u0000${padreId}`;
    if (!porPadre.has(clave)) porPadre.set(clave, { campo, padreId, ids: [] });
    porPadre.get(clave).ids.push(id);
  }
  for (const { campo, padreId, ids } of porPadre.values()) {
    await tx[delegado(modelo)].updateMany({ where: { id: { in: ids } }, data: { [campo]: padreId } });
  }
}

// Columnas autoincrement (Empresa.numero): Postgres no mueve la secuencia con inserts que traen
// el valor explícito, así que la siguiente empresa nueva chocaría con un número existente.
async function reajustarSecuencias(tx) {
  for (const modelo of Object.values(MODELO_POR_NOMBRE)) {
    for (const campo of modelo.fields) {
      if (campo.default?.name !== 'autoincrement') continue;
      const tabla = modelo.dbName || modelo.name;
      const columna = campo.dbName || campo.name;
      await tx.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${tabla}"', '${columna}'), COALESCE(MAX("${columna}"), 1), MAX("${columna}") IS NOT NULL) FROM "${tabla}"`,
      );
    }
  }
}

async function contarTodo(cliente) {
  const conteos = {};
  for (const modelo of ordenInsercion()) conteos[modelo.name] = await cliente[delegado(modelo)].count();
  return conteos;
}

async function main() {
  const ruta = path.resolve(archivo);
  console.log(`Respaldo:      ${ruta}`);
  console.log(`Base destino:  ${hostDe(process.env.DATABASE_URL)}  (de ${envPath})`);

  const { encabezado, conteos } = await validarArchivo(ruta);
  const total = Object.values(conteos).reduce((a, b) => a + b, 0);
  console.log(`Generado:      ${encabezado.generadoEn} (entorno ${encabezado.entorno || '?'})`);
  console.log(`Migración:     ${encabezado.migracion}`);
  console.log(`Contenido:     ${total} filas en ${Object.keys(conteos).length} tablas -- archivo íntegro.`);

  const prisma = new PrismaClient();
  try {
    const migracionDestino = await migracionActual(prisma);
    if (migracionDestino !== encabezado.migracion) {
      throw new Error(`La base destino está en la migración ${migracionDestino || '(ninguna)'} y el respaldo en ${encabezado.migracion}. Aplica las migraciones hasta esa misma (prisma migrate deploy con el código de esa versión).`);
    }
    const ocupadas = Object.entries(await contarTodo(prisma)).filter(([, n]) => n > 0);
    if (ocupadas.length) {
      throw new Error(`La base destino NO está vacía (${ocupadas.map(([t, n]) => `${t}: ${n}`).join(', ')}). Solo se restaura en una base vacía.`);
    }

    if (!confirmar) {
      console.log('\nSimulación OK: el respaldo se puede restaurar en esta base. Repite con --confirmar para hacerlo.');
      return;
    }

    console.log('\nRestaurando (una sola transacción: si algo falla, la base queda vacía como estaba)...');
    const inicio = Date.now();
    await prisma.$transaction(async (tx) => {
      let tablaActual = null;
      let pendientes = [];
      const cerrarTabla = async () => {
        if (tablaActual && pendientes.length) await ligarAutorreferencias(tx, MODELO_POR_NOMBRE[tablaActual], pendientes);
        pendientes = [];
      };

      let primera = true;
      for await (const obj of leerLineas(ruta)) {
        if (primera) { primera = false; continue; }
        if (obj.fin) break;
        if (obj.tabla !== tablaActual) {
          await cerrarTabla();
          tablaActual = obj.tabla;
          console.log(`  ${obj.tabla} (${conteos[obj.tabla]})`);
        }
        const modelo = MODELO_POR_NOMBRE[obj.tabla];
        await tx[delegado(modelo)].createMany({ data: prepararFilas(modelo, obj.filas, pendientes) });
      }
      await cerrarTabla();
      await reajustarSecuencias(tx);
    }, { timeout: 60 * 60 * 1000, maxWait: 15000 });

    const finales = await contarTodo(prisma);
    const diferencias = Object.entries(conteos).filter(([t, n]) => finales[t] !== n);
    if (diferencias.length) {
      throw new Error(`Restaurado, pero los conteos no cuadran: ${diferencias.map(([t, n]) => `${t} esperado ${n}, hay ${finales[t]}`).join('; ')}`);
    }
    console.log(`\nListo: ${total} filas restauradas y verificadas en ${Math.round((Date.now() - inicio) / 1000)} s.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(1);
});
