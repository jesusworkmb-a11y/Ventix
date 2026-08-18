// DD/MM/AAAA sin depender de datos de locale de ICU (no siempre disponibles en el entorno
// de producción) -- usado en mensajes de error dirigidos al usuario. Usa getters UTC porque
// vigenciaHasta llega de un <input type="date"> ("2026-01-01") y el Date resultante representa
// medianoche UTC -- con getters locales, cualquier zona horaria negativa (México, etc.) muestra
// un día menos del que se guardó.
function formatearFechaCorta(fecha) {
  const d = String(fecha.getUTCDate()).padStart(2, '0');
  const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const y = fecha.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

module.exports = { formatearFechaCorta };
