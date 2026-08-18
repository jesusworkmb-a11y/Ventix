const redondear = require('./redondear');

// Pasar SIEMPRE un string (no un number crudo) a un campo Decimal de Prisma — un `number` de JS
// puede reintroducir ruido de punto flotante en la conversión interna a Decimal aunque la
// variable de origen ya esté redondeada (bug real encontrado y documentado en Caja, 2026-08-03:
// 9.7 volvía como "9.699999999999999"). decimal.js parsea un string de forma exacta.
function aDecimalString(valor) {
  return redondear(Number(valor)).toFixed(2);
}

module.exports = { aDecimalString };
