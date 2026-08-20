const prisma = require('../../config/db');

// Registra una fila de auditoría dentro de la MISMA transacción que la mutación que la origina
// (pasar tx) para que quede atómico: o se guardan juntos el cambio y su rastro, o ninguno.
// Llamada explícita por cada service que mute algo auditable — no un hook genérico de Prisma,
// porque el snapshot valoresAntes/valoresDespues útil requiere el fetch específico de cada caso.
async function registrarAuditoria(tx, {
  empresaId,
  sucursalId = null,
  usuarioEjecutorId,
  usuarioAutorizadorId = null,
  accion,
  entidad,
  entidadId = null,
  folio = null,
  motivo = null,
  valoresAntes = null,
  valoresDespues = null,
  esAccionPlataforma = false,
}) {
  const client = tx || prisma;
  return client.auditoria.create({
    data: {
      empresaId,
      sucursalId,
      usuarioEjecutorId,
      usuarioAutorizadorId,
      accion,
      entidad,
      entidadId,
      folio,
      motivo,
      valoresAntes,
      valoresDespues,
      esAccionPlataforma,
    },
  });
}

module.exports = { registrarAuditoria };
