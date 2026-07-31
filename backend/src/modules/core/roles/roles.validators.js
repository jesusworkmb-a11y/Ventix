const { z } = require('zod');

const crearRolSchema = z.object({ nombre: z.string().min(1) });
const actualizarRolSchema = z.object({ nombre: z.string().min(1) });
const permisosRolSchema = z.object({ claves: z.array(z.string()).default([]) });

module.exports = { crearRolSchema, actualizarRolSchema, permisosRolSchema };
