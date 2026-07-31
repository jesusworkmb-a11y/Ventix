const { z } = require('zod');

const crearCajaSchema = z.object({
  sucursalId: z.string().min(1),
  nombre: z.string().min(1),
});

const actualizarCajaSchema = z.object({
  nombre: z.string().min(1).optional(),
  activa: z.boolean().optional(),
});

module.exports = { crearCajaSchema, actualizarCajaSchema };
