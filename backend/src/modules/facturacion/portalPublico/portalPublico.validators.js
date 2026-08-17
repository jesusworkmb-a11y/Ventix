const { z } = require('zod');
const { receptorSchema } = require('../facturas/facturas.validators');

const buscarVentaSchema = z.object({
  folio: z.string().trim().min(1),
  total: z.coerce.number().positive(),
});

// El portal público no tiene sesión ni acceso al listado de Clientes de la empresa, así que a
// diferencia del receptor autenticado nunca se puede vincular a un `clienteId` existente -- la
// factura queda "suelta" (mismo comportamiento que "Público en general" en Factura Directa).
const facturarSchema = buscarVentaSchema.extend({
  receptor: receptorSchema.omit({ clienteId: true }),
});

module.exports = { buscarVentaSchema, facturarSchema };
