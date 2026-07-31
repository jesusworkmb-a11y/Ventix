const { z } = require('zod');

const existenciaInicialSchema = z.object({
  sucursalId: z.string().min(1),
  articuloId: z.string().min(1),
  cantidad: z.coerce.number().nonnegative(),
});

module.exports = { existenciaInicialSchema };
