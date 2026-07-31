const { z } = require('zod');

const crearCompraSchema = z.object({
  sucursalId: z.string().min(1),
  proveedorId: z.string().min(1),
  detalles: z
    .array(
      z.object({
        articuloId: z.string().min(1),
        unidadId: z.string().min(1),
        cantidad: z.coerce.number().positive(),
        costo: z.coerce.number().nonnegative(),
      }),
    )
    .min(1),
});

module.exports = { crearCompraSchema };
