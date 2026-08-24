const { z } = require('zod');

const crearListaPrecioSchema = z.object({
  nombre: z.string().min(1),
  esBase: z.boolean().optional(),
});

const actualizarListaPrecioSchema = z.object({
  nombre: z.string().min(1).optional(),
  esBase: z.boolean().optional(),
  activo: z.boolean().optional(),
});

module.exports = { crearListaPrecioSchema, actualizarListaPrecioSchema };
