const { z } = require('zod');

const crearMarcaSchema = z.object({ nombre: z.string().min(1) });
const actualizarMarcaSchema = z.object({ nombre: z.string().min(1) });

module.exports = { crearMarcaSchema, actualizarMarcaSchema };
