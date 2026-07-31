const { z } = require('zod');

const crearUsuarioSchema = z.object({
  nombre: z.string().min(1),
  correo: z.string().email(),
  password: z.string().min(8),
  rolId: z.string().min(1),
});

const actualizarUsuarioSchema = z
  .object({
    rolId: z.string().min(1),
    estado: z.enum(['ACTIVO', 'INACTIVO', 'BLOQUEADO']),
    telefono: z.string(),
  })
  .partial();

module.exports = { crearUsuarioSchema, actualizarUsuarioSchema };
