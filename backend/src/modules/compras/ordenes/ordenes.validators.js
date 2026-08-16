const { z } = require('zod');

const crearOrdenCompraSchema = z.object({
  sucursalId: z.string().min(1),
  proveedorId: z.string().min(1),
  observaciones: z.string().trim().max(500).optional(),
  detalles: z
    .array(
      z.object({
        articuloId: z.string().min(1),
        unidadId: z.string().min(1),
        cantidad: z.coerce.number().positive(),
        costoEstimado: z.coerce.number().nonnegative().optional(),
      }),
    )
    .min(1),
});

module.exports = { crearOrdenCompraSchema };
