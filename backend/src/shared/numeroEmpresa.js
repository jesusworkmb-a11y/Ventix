const PREFIJO = 'BOX-';

// Formatea el contador secuencial crudo (Empresa.numero) para mostrarlo a soporte/superadmin.
function formatearNumeroEmpresa(numero) {
  return `${PREFIJO}${String(numero).padStart(4, '0')}`;
}

// Acepta "BOX-0007", "box-7" o "7" -- tolerante al formato exacto porque lo tipea el usuario
// final desde el formulario de recuperación de acceso, no lo copia de la UI de superadmin.
function parsearNumeroEmpresa(texto) {
  if (!texto) return null;
  const match = String(texto).trim().toUpperCase().match(/^(?:BOX-)?(\d+)$/);
  if (!match) return null;
  return Number(match[1]);
}

module.exports = { formatearNumeroEmpresa, parsearNumeroEmpresa, PREFIJO };
