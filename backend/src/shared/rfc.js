const { z } = require('zod');

// Extraído de facturacion/facturas/facturas.validators.js (donde ya vivía, obligatorio ahí) para
// poder reusarlo también en clientes/proveedores (opcional ahí) sin duplicar el regex —
// encontrado en la ronda de QA pre-lanzamiento: Cliente.rfc/Proveedor.rfc no validaban formato,
// aunque Cliente.rfc se usa como default para prellenar el receptor al facturar.
const rfcSchema = z
  .string()
  .trim()
  .regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i, 'RFC con formato inválido.')
  .transform((v) => v.toUpperCase());

module.exports = { rfcSchema };
