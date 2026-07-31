const { z } = require('zod');

const crearAjusteSchema = z.object({
  sucursalId: z.string().min(1),
  motivo: z.string().min(1),
  autorizadoPorId: z.string().min(1).optional(),
  detalles: z
    .array(
      z.object({
        articuloId: z.string().min(1),
        cantidad: z.coerce.number().refine((v) => v !== 0, 'La cantidad no puede ser 0'),
      }),
    )
    .min(1),
});

module.exports = { crearAjusteSchema };
