const { z } = require('zod');

const CLAVES_IMPUESTO_SAT = ['001', '002', '003']; // ISR, IVA, IEPS
const TIPOS_FACTOR_SAT = ['Tasa', 'Cuota', 'Exento'];

const crearImpuestoSchema = z.object({
  nombre: z.string().min(1),
  tasa: z.coerce.number().min(0).max(1),
  claveImpuestoSat: z.enum(CLAVES_IMPUESTO_SAT).optional(),
  tipoFactorSat: z.enum(TIPOS_FACTOR_SAT).optional(),
});

const actualizarImpuestoSchema = z.object({
  nombre: z.string().min(1).optional(),
  tasa: z.coerce.number().min(0).max(1).optional(),
  claveImpuestoSat: z.enum(CLAVES_IMPUESTO_SAT).optional(),
  tipoFactorSat: z.enum(TIPOS_FACTOR_SAT).optional(),
});

module.exports = { crearImpuestoSchema, actualizarImpuestoSchema };
