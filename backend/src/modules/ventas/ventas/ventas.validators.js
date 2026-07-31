const { z } = require('zod');

const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MIXTO'];

const crearVentaSchema = z.object({
  sucursalId: z.string().min(1),
  clienteId: z.string().min(1),
  sesionCajaId: z.string().min(1),
  detalles: z
    .array(
      z.object({
        articuloId: z.string().min(1),
        cantidad: z.coerce.number().positive(),
        precio: z.coerce.number().nonnegative().optional(),
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
});

module.exports = { crearVentaSchema };
