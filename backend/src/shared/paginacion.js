const POR_PAGINA_DEFECTO = 20;
const POR_PAGINA_MAX = 100;

// Lee pagina/porPagina de query params ya validados por el controller — clamps a rangos
// razonables en vez de rechazar, así una paginación fuera de rango degrada con gracia.
function parsePaginacion({ pagina, porPagina } = {}) {
  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);
  const porPaginaNum = Math.min(POR_PAGINA_MAX, Math.max(1, parseInt(porPagina, 10) || POR_PAGINA_DEFECTO));
  return { pagina: paginaNum, porPagina: porPaginaNum, skip: (paginaNum - 1) * porPaginaNum, take: porPaginaNum };
}

// `columnas` mapea la clave que manda el frontend a un path de campo Prisma ("folio",
// "cliente.nombre" para relaciones) — whitelist para no dejar ordenar por columnas
// arbitrarias ni exponer campos internos.
function parseOrden({ ordenarPor, orden }, columnas, porDefecto) {
  const campo = columnas[ordenarPor];
  if (!campo) return porDefecto;
  const direccion = orden === 'asc' ? 'asc' : 'desc';
  return campo.split('.').reduceRight((acc, parte) => ({ [parte]: acc }), direccion);
}

function respuestaPaginada(datos, total, { pagina, porPagina }) {
  return { datos, total, pagina, porPagina, totalPaginas: Math.max(1, Math.ceil(total / porPagina)) };
}

module.exports = { parsePaginacion, parseOrden, respuestaPaginada };
