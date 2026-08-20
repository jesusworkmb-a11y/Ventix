// Reintenta una escritura local (a la DB) unas pocas veces con backoff corto antes de darse por
// vencido. Pensado específicamente para el punto en que un CFDI YA se timbró/canceló de verdad
// ante el SAT vía el PAC (facturama.service.js) y lo único que falta es persistir ese resultado
// localmente -- un blip transitorio de conexión ahí no debe traducirse en "reintentar desde cero"
// (lo que llamaría de nuevo a facturama.timbrar()/cancelar() y generaría un CFDI/cancelación
// duplicada ante el SAT). No es un helper de propósito general: para todo lo demás en el proyecto
// (condiciones de carrera entre requests) el patrón correcto sigue siendo el candado atómico
// (UPDATE...WHERE / SELECT...FOR UPDATE), no reintentos.
const AppError = require('./errors/AppError');

async function reintentarEscritura(fn, { intentos = 3, esperaMs = 500 } = {}) {
  let ultimoError;
  for (let intento = 1; intento <= intentos; intento += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (error) {
      // Un AppError es un rechazo de negocio deliberado (ej. "ya está cancelada" por un
      // candado atómico perdiendo la carrera) -- no un blip transitorio, reintentarlo no
      // cambiaría el resultado, solo demora la respuesta.
      if (error instanceof AppError) throw error;
      ultimoError = error;
      if (intento < intentos) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => { setTimeout(resolve, esperaMs * intento); });
      }
    }
  }
  throw ultimoError;
}

module.exports = reintentarEscritura;
