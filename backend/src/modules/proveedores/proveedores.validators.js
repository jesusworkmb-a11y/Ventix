const { z } = require('zod');

const crearProveedorSchema = z.object({
  nombre: z.string().min(1),
  telefono: z.string().optional(),
  correo: z.string().email().optional(),
  rfc: z.string().optional(),
  direccion: z.string().optional(),
});

const actualizarProveedorSchema = crearProveedorSchema.partial().extend({
  activo: z.boolean().optional(),
});

module.exports = { crearProveedorSchema, actualizarProveedorSchema };
