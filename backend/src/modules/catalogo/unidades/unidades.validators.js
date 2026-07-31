const { z } = require('zod');

const crearUnidadSchema = z.object({
  nombre: z.string().min(1),
  abreviatura: z.string().optional(),
});

const actualizarUnidadSchema = z.object({
  nombre: z.string().min(1).optional(),
  abreviatura: z.string().optional(),
});

module.exports = { crearUnidadSchema, actualizarUnidadSchema };
