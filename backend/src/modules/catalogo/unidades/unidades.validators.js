const { z } = require('zod');

const crearUnidadSchema = z.object({
  nombre: z.string().min(1),
  abreviatura: z.string().optional(),
  claveUnidadSat: z.string().min(1).optional(), // c_ClaveUnidad SAT
});

const actualizarUnidadSchema = z.object({
  nombre: z.string().min(1).optional(),
  abreviatura: z.string().optional(),
  claveUnidadSat: z.string().min(1).nullable().optional(),
});

module.exports = { crearUnidadSchema, actualizarUnidadSchema };
