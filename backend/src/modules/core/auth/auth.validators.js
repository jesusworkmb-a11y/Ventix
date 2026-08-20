const { z } = require('zod');

const registroSchema = z.object({
  empresa: z.object({
    nombreComercial: z.string().min(1),
    razonSocial: z.string().optional(),
    rfc: z.string().optional(),
    pais: z.string().min(1),
    moneda: z.string().min(1),
    zonaHoraria: z.string().min(1),
    correo: z.string().email().optional(),
    telefono: z.string().optional(),
  }),
  admin: z.object({
    nombre: z.string().min(1),
    correo: z.string().email(),
    password: z.string().min(8),
  }),
});

const loginSchema = z.object({
  correo: z.string().email(),
  password: z.string().min(1),
});

const recuperarSchema = z.object({
  correo: z.string().email(),
  numeroEmpresa: z.string().min(1),
});

const restablecerSchema = z.object({
  token: z.string().min(1),
  passwordNueva: z.string().min(8),
});

module.exports = {
  registroSchema, loginSchema, recuperarSchema, restablecerSchema,
};
