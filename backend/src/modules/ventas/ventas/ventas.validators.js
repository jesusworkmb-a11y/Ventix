const { z } = require('zod');

const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MIXTO'];

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
        })
        .refine((d) => !(d.descuentoId && d.promocionId), {
          message: 'Una línea no puede tener un descuento y una promoción a la vez.',
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
