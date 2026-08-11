const { z } = require('zod');

const crearAtributoSchema = z.object({
  nombre: z.string().min(1),
});

const actualizarAtributoSchema = z.object({
  nombre: z.string().min(1),
});

const crearValorSchema = z.object({
  valor: z.string().min(1),
});

const actualizarValorSchema = z.object({
  valor: z.string().min(1),
});

module.exports = { crearAtributoSchema, actualizarAtributoSchema, crearValorSchema, actualizarValorSchema };
