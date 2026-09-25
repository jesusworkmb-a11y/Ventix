const { Prisma } = require('@prisma/client');

// Respaldo de la base (Fase 4 de la hoja de ruta de lanzamiento). Lo usan el endpoint de
// superadmin (genera) y scripts/restaurarRespaldo.js (restaura) -- por eso vive en shared.
//
// Formato: NDJSON comprimido con gzip. Línea 1 = encabezado, luego una línea por lote de filas
// ({ tabla, filas }), y una línea final { fin: true, conteos } que prueba que el archivo llegó
// completo (si el stream se corta a medias, falta y el restaurador lo rechaza).
//
// Las tablas se leen del DMMF de Prisma, no de una lista a mano: una tabla nueva entra sola al
// respaldo completo, y si no se sabe cómo ligarla a una empresa, el respaldo por empresa truena
// con un mensaje claro en vez de omitirla en silencio.

const FORMATO = 'boxpos-respaldo';
const VERSION = 1;
const LOTE = 1000;

const MODELOS = Prisma.dmmf.datamodel.models;
const MODELO_POR_NOMBRE = Object.fromEntries(MODELOS.map((m) => [m.name, m]));

// Tablas globales (no pertenecen a una empresa) y cómo se tratan en el respaldo por empresa.
// El respaldo completo siempre lleva TODO, secretos incluidos -- sin eso no se puede restaurar.
const POR_EMPRESA_ESPECIAL = {
  // Solo los usuarios ligados a la empresa, sin el hash de contraseña.
  Usuario: (empresaId) => ({ where: { empresas: { some: { empresaId } } }, sinCampos: ['passwordHash'] }),
  PermisoUsuarioExcepcion: (empresaId) => ({ where: { usuario: { empresas: { some: { empresaId } } } } }),
  // Catálogo global chico, necesario para interpretar RolPermiso.
  Permiso: () => ({ where: {} }),
  // Acciones del superadmin sobre la empresa: la empresa no las ve en su bitácora, tampoco aquí.
  Auditoria: (empresaId) => ({ where: { empresaId, esAccionPlataforma: false } }),
  // Fuera: tokens de recuperación (secretos) y catálogos SAT (globales, se reimportan con script).
  PasswordResetToken: null,
  CatalogoSat: null,
};

function delegado(modelo) {
  return modelo.name.charAt(0).toLowerCase() + modelo.name.slice(1);
}

function relacionesSalientes(modelo) {
  return modelo.fields.filter((f) => f.kind === 'object' && f.relationFromFields?.length);
}

// Orden en que se pueden insertar las tablas sin violar llaves foráneas: cada tabla después de
// las que referencia. Las autorreferencias (categoría padre, artículo padre) se resuelven fila
// por fila en el restaurador, no aquí.
function ordenInsercion() {
  const orden = [];
  const visitados = new Set();
  const enCurso = new Set();

  function visitar(nombre) {
    if (visitados.has(nombre)) return;
    if (enCurso.has(nombre)) throw new Error(`Ciclo de llaves foráneas entre tablas en ${nombre}.`);
    enCurso.add(nombre);
    for (const rel of relacionesSalientes(MODELO_POR_NOMBRE[nombre])) {
      if (rel.type !== nombre) visitar(rel.type);
    }
    enCurso.delete(nombre);
    visitados.add(nombre);
    orden.push(MODELO_POR_NOMBRE[nombre]);
  }

  // Alfabético para que el orden sea estable entre corridas.
  [...MODELOS].sort((a, b) => a.name.localeCompare(b.name)).forEach((m) => visitar(m.name));
  return orden;
}

// Filtro Prisma que deja solo las filas de una empresa: por empresaId directo, o subiendo por
// una relación obligatoria hasta una tabla que lo tenga (VentaDetalle -> venta -> empresaId).
function filtroEmpresa(modelo, empresaId, visitando = new Set()) {
  if (modelo.name === 'Empresa') return { id: empresaId };
  if (modelo.fields.some((f) => f.name === 'empresaId' && f.kind === 'scalar')) return { empresaId };
  if (visitando.has(modelo.name)) return null;
  visitando.add(modelo.name);

  for (const rel of relacionesSalientes(modelo)) {
    if (!rel.isRequired || rel.type === modelo.name) continue;
    const padre = filtroEmpresa(MODELO_POR_NOMBRE[rel.type], empresaId, visitando);
    if (padre) return { [rel.name]: padre };
  }
  return null;
}

// Plan de lectura por tabla: { modelo, where, sinCampos } o null si la tabla no va.
function planTabla(modelo, empresaId) {
  if (!empresaId) return { modelo, where: {}, sinCampos: [] };

  if (modelo.name in POR_EMPRESA_ESPECIAL) {
    const especial = POR_EMPRESA_ESPECIAL[modelo.name];
    if (!especial) return null;
    const { where, sinCampos = [] } = especial(empresaId);
    return { modelo, where, sinCampos };
  }

  const where = filtroEmpresa(modelo, empresaId);
  if (!where) {
    throw new Error(
      `La tabla ${modelo.name} no tiene cómo ligarse a una empresa. Clasificarla en `
      + 'POR_EMPRESA_ESPECIAL (shared/respaldo.js) antes de generar respaldos por empresa.',
    );
  }
  return { modelo, where, sinCampos: [] };
}

async function migracionActual(cliente) {
  const [fila] = await cliente.$queryRaw`
    SELECT migration_name FROM _prisma_migrations
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ORDER BY migration_name DESC LIMIT 1`;
  return fila?.migration_name || null;
}

// Genera el respaldo llamando a escribir(linea) por cada línea NDJSON (escribir puede ser async
// para respetar la contrapresión del stream). Todo se lee dentro de UNA transacción REPEATABLE
// READ: es una foto fija de la base, así una venta registrada a mitad de la descarga no deja
// detalles sin su venta (que luego romperían la restauración por llave foránea).
async function generarRespaldo(prisma, { empresa = null, escribir }) {
  const planes = ordenInsercion().map((m) => planTabla(m, empresa?.id)).filter(Boolean);

  return prisma.$transaction(async (tx) => {
    const conteos = {};
    await escribir(`${JSON.stringify({
      formato: FORMATO,
      version: VERSION,
      tipo: empresa ? 'empresa' : 'completo',
      empresa: empresa ? { id: empresa.id, numero: empresa.numero, nombreComercial: empresa.nombreComercial } : null,
      generadoEn: new Date().toISOString(),
      entorno: process.env.ENTORNO || null,
      migracion: await migracionActual(tx),
      tablas: planes.map((p) => p.modelo.name),
    })}\n`);

    for (const { modelo, where, sinCampos } of planes) {
      conteos[modelo.name] = 0;
      let cursor = null;
      for (;;) {
        const filas = await tx[delegado(modelo)].findMany({
          where,
          orderBy: { id: 'asc' },
          take: LOTE,
          ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        });
        if (filas.length === 0) break;
        for (const fila of filas) sinCampos.forEach((c) => delete fila[c]);
        conteos[modelo.name] += filas.length;
        await escribir(`${JSON.stringify({ tabla: modelo.name, filas })}\n`);
        if (filas.length < LOTE) break;
        cursor = filas[filas.length - 1].id;
      }
    }

    await escribir(`${JSON.stringify({ fin: true, conteos })}\n`);
    return conteos;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 10 * 60 * 1000, maxWait: 15000 });
}

module.exports = {
  FORMATO,
  VERSION,
  MODELO_POR_NOMBRE,
  delegado,
  ordenInsercion,
  planTabla,
  migracionActual,
  generarRespaldo,
};
