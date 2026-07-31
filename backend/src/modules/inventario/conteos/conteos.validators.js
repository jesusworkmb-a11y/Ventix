const { z } = require('zod');

const crearConteoSchema = z.object({ sucursalId: z.string().min(1) });

const detallesConteoSchema = z.object({
  detalles: z.array(
    z.object({
      articuloId: z.string().min(1),
      cantidadFisica: z.coerce.number().nonnegative(),
    }),
  ),
});

const estadoConteoSchema = z.object({
  estado: z.enum(['REVISION', 'AUTORIZADO']),
});

module.exports = { crearConteoSchema, detallesConteoSchema, estadoConteoSchema };
