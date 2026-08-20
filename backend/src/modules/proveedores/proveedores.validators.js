const { z } = require('zod');
const { rfcSchema } = require('../../shared/rfc');

const crearProveedorSchema = z.object({
  nombre: z.string().min(1),
  telefono: z.string().optional(),
  correo: z.string().email().optional(),
  // rfcSchema en vez de z.string() suelto: no se validaba formato (ronda de QA pre-lanzamiento).
  rfc: rfcSchema.optional(),
  direccion: z.string().optional(),
});

const actualizarProveedorSchema = crearProveedorSchema.partial().extend({
  activo: z.boolean().optional(),
});

module.exports = { crearProveedorSchema, actualizarProveedorSchema };
