const DIAS_AVISO_VIGENCIA = 5;

// Días que faltan para que venza la suscripción (negativo si ya venció). null = sin vigencia
// definida (empresa sin vencimiento, no hay nada que avisar). Cálculo 100% en el frontend porque
// Empresa.vigenciaHasta ya viaja completo en /me y login -- no hace falta un endpoint nuevo.
export function diasParaVencerVigencia(vigenciaHasta) {
  if (!vigenciaHasta) return null;
  const ms = new Date(vigenciaHasta).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// true cuando faltan DIAS_AVISO_VIGENCIA días o menos (incluye ya vencida: días negativos).
export function vigenciaProximaAVencer(vigenciaHasta) {
  const dias = diasParaVencerVigencia(vigenciaHasta);
  return dias !== null && dias <= DIAS_AVISO_VIGENCIA;
}

export { DIAS_AVISO_VIGENCIA };

// true cuando la vigencia ya pasó. Con la vigencia vencida, el backend solo deja entrar a quien
// administra la empresa y limita su sesión a /me + /suscripcion (ver auth.middleware.js) — el
// frontend lo refleja mandando todo a la pantalla de pago (ProtectedRoute).
export function vigenciaVencida(vigenciaHasta) {
  return !!vigenciaHasta && new Date(vigenciaHasta).getTime() < Date.now();
}
