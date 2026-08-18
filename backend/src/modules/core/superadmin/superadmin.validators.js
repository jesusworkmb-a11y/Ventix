const { z } = require('zod');

const cambiarEstadoSchema = z.object({
  estado: z.enum(['ACTIVA', 'SUSPENDIDA', 'ARCHIVADA']),
});

// vigenciaHasta: null = quitar vencimiento (sin vigencia definida); string = fecha ISO
// (viene de un <input type="date"> del frontend, ej. "2026-09-30").
const actualizarVigenciaSchema = z.object({
  vigenciaHasta: z.coerce.date().nullable(),
});

const actualizarPlanSchema = z.object({
  plan: z.string().trim().min(1).max(60),
});

module.exports = { cambiarEstadoSchema, actualizarVigenciaSchema, actualizarPlanSchema };
