const { z } = require('zod');

const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MIXTO'];
const TIPOS_DESCUENTO = ['PORCENTAJE', 'MONTO_FIJO'];

// Descuento cargado directo en la venta (no ligado a un registro de Catálogo) — a diferencia
// de descuentoId/promocionId, este SIEMPRE exige autorización de supervisor (ver
// resolverDescuentoLinea en ventas.service.js), justamente porque no fue pre-aprobado al
// configurarse en el catálogo.
const descuentoManualSchema = z
  .object({
    tipo: z.enum(TIPOS_DESCUENTO),
    valor: z.coerce.number().positive(),
  })
  .refine((d) => d.tipo !== 'PORCENTAJE' || d.valor <= 100, {
    message: 'El porcentaje debe estar entre 0 y 100.',
    path: ['valor'],
  });

const crearVentaSchema = z.object({
  sucursalId: z.string().min(1),
  clienteId: z.string().min(1),
  sesionCajaId: z.string().min(1),
  detalles: z
    .array(
      z
        .object({
          articuloId: z.string().min(1),
          cantidad: z.coerce.number().positive(),
          precio: z.coerce.number().nonnegative().optional(),
          descuentoId: z.string().min(1).optional(),
          promocionId: z.string().min(1).optional(),
          descuentoManual: descuentoManualSchema.optional(),
        })
        .refine((d) => [d.descuentoId, d.promocionId, d.descuentoManual].filter(Boolean).length <= 1, {
          message: 'Una línea no puede combinar descuento, promoción y descuento manual a la vez.',
          path: ['promocionId'],
        }),
    )
    .min(1),
  pagos: z
    .array(
      z.object({
        metodo: z.enum(METODOS_PAGO),
        monto: z.coerce.number().positive(),
      }),
    )
    .min(1),
  // Requerido solo si alguna línea usa un descuento/promoción con requiereAprobacion=true
  // (validado en el service, no acá — depende de datos de la DB).
  autorizadoPorId: z.string().min(1).optional(),
});

module.exports = { crearVentaSchema };
