const { z } = require('zod');

const crearTransferenciaSchema = z
  .object({
    sucursalOrigenId: z.string().min(1),
    sucursalDestinoId: z.string().min(1),
    detalles: z
      .array(
        z.object({
          articuloId: z.string().min(1),
          cantidad: z.coerce.number().positive(),
        }),
      )
      .min(1),
  })
  .refine((d) => d.sucursalOrigenId !== d.sucursalDestinoId, {
    message: 'La sucursal de origen y destino deben ser distintas.',
    path: ['sucursalDestinoId'],
  });

module.exports = { crearTransferenciaSchema };
