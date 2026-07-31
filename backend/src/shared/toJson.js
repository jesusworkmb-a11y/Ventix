// Normaliza un objeto (puede traer Date/Decimal de Prisma) a algo JSON-seguro para guardar
// en columnas Json — Prisma no acepta instancias de Date/Decimal directamente ahí.
function toJson(value) {
  return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
}

module.exports = toJson;
