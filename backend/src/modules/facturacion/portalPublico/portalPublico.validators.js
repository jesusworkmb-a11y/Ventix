const { z } = require('zod');
const { receptorSchema } = require('../facturas/facturas.validators');
const { rfcSchema } = require('../../../shared/rfc');

// rfcEmisor: tercer factor de verificación (a pedido del usuario, ronda de QA pre-lanzamiento) --
// junto a folio+total, el visitante debe indicar también el RFC de la empresa/sucursal que
// emitió la venta, impreso en el ticket. El slug de la URL ya fija la empresa, así que esto no
// sirve para "elegir" empresa -- sirve como dato adicional difícil de adivinar a ciegas (a
// diferencia del nombre comercial, visible en la misma pantalla) antes de dejar timbrar un CFDI
// real. Ver portalPublico.service.js#buscarVentaFacturable.
const buscarVentaSchema = z.object({
  folio: z.string().trim().min(1),
  total: z.coerce.number().positive(),
  rfcEmisor: rfcSchema,
});

// El portal público no tiene sesión ni acceso al listado de Clientes de la empresa, así que a
// diferencia del receptor autenticado nunca se puede vincular a un `clienteId` existente -- la
// factura queda "suelta" (mismo comportamiento que "Público en general" en Factura Directa).
const facturarSchema = buscarVentaSchema.extend({
  receptor: receptorSchema.omit({ clienteId: true }),
});

module.exports = { buscarVentaSchema, facturarSchema };
