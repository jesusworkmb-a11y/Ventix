const { z } = require('zod');
const { descuentoManualSchema } = require('../ventas/ventas.validators');

const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MIXTO'];

const crearCotizacionSchema = z.object({
  sucursalId: z.string().min(1),
  clienteId: z.string().min(1),
  detalles: z
    .array(
      z.object({
        articuloId: z.string().min(1),
        cantidad: z.coerce.number().positive(),
        precio: z.coerce.number().nonnegative().optional(),
        // A diferencia de Ventas, acá no hay descuento/promoción de catálogo — solo este
        // descuento manual por línea, sin permiso para cargarse (sí lo exige convertir()).
        descuentoManual: descuentoManualSchema.optional(),
      }),
    )
    .min(1),
});

const convertirCotizacionSchema = z.object({
  sesionCajaId: z.string().min(1),
  pagos: z
    .array(
      z.object({
        metodo: z.enum(METODOS_PAGO),
        monto: z.coerce.number().positive(),
      }),
    )
    .min(1),
  // Requerido solo si la cotización tiene algún descuento manual (siempre requiereAprobacion,
  // ver ventas.service.js#resolverDescuentoLinea) — el chequeo real vive en ventasService.crear().
  autorizadoPorId: z.string().min(1).optional(),
});

module.exports = { crearCotizacionSchema, convertirCotizacionSchema };
