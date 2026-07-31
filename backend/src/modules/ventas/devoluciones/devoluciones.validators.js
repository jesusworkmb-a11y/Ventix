const { z } = require('zod');

const crearDevolucionSchema = z.object({
  ventaId: z.string().min(1),
  motivo: z.string().min(1),
  autorizadoPorId: z.string().min(1),
  sesionCajaId: z.string().min(1).optional(),
  detalles: z
    .array(
      z.object({
        articuloId: z.string().min(1),
        cantidad: z.coerce.number().positive(),
        vuelveAStock: z.boolean().default(true),
      }),
    )
    .min(1),
});

module.exports = { crearDevolucionSchema };
