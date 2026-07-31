// Redondea a 2 decimales — evita artefactos de punto flotante en montos de dinero
// (p.ej. 60 + 9.6 = 69.59999999999999 en JS) antes de guardarlos o compararlos.
function redondear(valor) {
  return Math.round(valor * 100) / 100;
}

module.exports = redondear;
