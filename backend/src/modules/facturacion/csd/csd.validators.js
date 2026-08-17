const { z } = require('zod');

const registrarCsdSchema = z.object({
  rfc: z.string().trim().min(12).max(13).transform((v) => v.toUpperCase()),
  certificadoBase64: z.string().min(1),
  llaveBase64: z.string().min(1),
  contrasena: z.string().min(1),
});

module.exports = { registrarCsdSchema };
