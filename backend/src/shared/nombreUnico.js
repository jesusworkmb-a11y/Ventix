const { Prisma } = require('@prisma/client');
const AppError = require('./errors/AppError');

// Valida que `nombre` no esté ya usado por otro registro del mismo modelo dentro de la
// empresa (insensible a mayúsculas/minúsculas), opcionalmente acotado por `alcance`
// (p.ej. categoriaPadreId, para permitir el mismo nombre de subcategoría bajo padres
// distintos). Chequeo previo, no atómico — `relanzarConflictoNombre` es la última línea
// de defensa contra dos altas/ediciones simultáneas, mismo patrón que SKU/código de
// barras en articulos.service.js.
async function validarNombreUnico({ prisma, modelo, empresaId, id, nombre, alcance, mensaje }) {
  if (!nombre) return;
  const existente = await prisma[modelo].findFirst({
    where: { empresaId, ...alcance, nombre: { equals: nombre, mode: 'insensitive' } },
  });
  if (existente && existente.id !== id) throw new AppError(409, mensaje);
}

// Traduce el constraint único de la DB (P2002) al mismo error de negocio 409 que ya
// lanza validarNombreUnico.
function relanzarConflictoNombre(error, mensaje) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError(409, mensaje);
  }
  throw error;
}

module.exports = { validarNombreUnico, relanzarConflictoNombre };
