const { z } = require('zod');

const crearCategoriaSchema = z.object({
  nombre: z.string().min(1),
  categoriaPadreId: z.string().min(1).optional(),
});

const actualizarCategoriaSchema = z.object({
  nombre: z.string().min(1).optional(),
  categoriaPadreId: z.string().min(1).nullable().optional(),
});

module.exports = { crearCategoriaSchema, actualizarCategoriaSchema };
