const DIAS_AVISO_VIGENCIA = 5;

// Días que faltan para que venza la suscripción (negativo si ya venció). null = sin vigencia
// definida (empresa sin vencimiento, no hay nada que avisar). Cálculo 100% en el frontend porque
// Empresa.vigenciaHasta ya viaja completo en /me y login -- no hace falta un endpoint nuevo.
export function diasParaVencerVigencia(vigenciaHasta) {
  if (!vigenciaHasta) return null;
  const ms = new Date(vigenciaHasta).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// true cuando faltan DIAS_AVISO_VIGENCIA días o menos. El caso "ya vencida" (días negativos) es
// en la práctica casi inalcanzable con sesión abierta: auth.middleware.js revalida vigenciaHasta
// en CADA request (no solo al loguear), así que apenas vence, la siguiente llamada a /me ya
// devuelve 403 y corta la sesión -- se deja el texto igual por las dudas (defensivo, no dañino).
export function vigenciaProximaAVencer(vigenciaHasta) {
  const dias = diasParaVencerVigencia(vigenciaHasta);
  return dias !== null && dias <= DIAS_AVISO_VIGENCIA;
}

export { DIAS_AVISO_VIGENCIA };
