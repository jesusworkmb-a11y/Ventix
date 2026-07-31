const { z } = require('zod');

const crearSucursalSchema = z.object({
  nombre: z.string().min(1),
  clave: z.string().min(1),
  telefono: z.string().optional(),
  correo: z.string().email().optional(),
  direccion: z.string().optional(),
  responsable: z.string().optional(),
});

const actualizarSucursalSchema = z
  .object({
    nombre: z.string().min(1),
    telefono: z.string().optional(),
    correo: z.string().email().optional(),
    direccion: z.string().optional(),
    responsable: z.string().optional(),
    estado: z.enum(['ACTIVA', 'SUSPENDIDA', 'ARCHIVADA']),
  })
  .partial();

module.exports = { crearSucursalSchema, actualizarSucursalSchema };
