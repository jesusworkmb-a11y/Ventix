const { z } = require('zod');

const crearImpuestoSchema = z.object({
  nombre: z.string().min(1),
  tasa: z.coerce.number().min(0).max(1),
});

const actualizarImpuestoSchema = z.object({
  nombre: z.string().min(1).optional(),
  tasa: z.coerce.number().min(0).max(1).optional(),
});

module.exports = { crearImpuestoSchema, actualizarImpuestoSchema };
