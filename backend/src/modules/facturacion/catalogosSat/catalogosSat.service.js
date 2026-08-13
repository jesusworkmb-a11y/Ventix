const prisma = require('../../../config/db');

const LIMITE_DEFAULT = 30;
const LIMITE_MAXIMO = 100;

// CatalogoSat no es multi-tenant (los catálogos del SAT son los mismos para todas las
// empresas), así que a diferencia del resto del proyecto esta búsqueda no filtra por empresaId.
async function buscar({ tipo, q, limite }) {
  const take = Math.min(Math.max(Number(limite) || LIMITE_DEFAULT, 1), LIMITE_MAXIMO);
  const where = { tipo, activo: true };
  const texto = (q || '').trim();
  if (texto) {
    where.OR = [
      { descripcion: { contains: texto, mode: 'insensitive' } },
      { clave: { contains: texto, mode: 'insensitive' } },
    ];
  }
  return prisma.catalogoSat.findMany({ where, orderBy: { clave: 'asc' }, take });
}

module.exports = { buscar };
