const formateador = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const formateadorFecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' });

export function formatoMoneda(valor) {
  return formateador.format(Number(valor) || 0);
}

export function formatoFecha(fecha) {
  return formateadorFecha.format(new Date(fecha));
}

// Mismo formato que backend/src/shared/numeroEmpresa.js#formatearNumeroEmpresa -- duplicado a
// propósito (frontend/backend no comparten código), mantenerlos en sync si cambia el prefijo.
export function formatoNumeroEmpresa(numero) {
  return `BOX-${String(numero).padStart(4, '0')}`;
}

export function tiempoRelativo(fecha) {
  const diffMs = Date.now() - new Date(fecha).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'Justo ahora';
  if (min < 60) return `Hace ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.round(horas / 24);
  return `Hace ${dias} d`;
}
