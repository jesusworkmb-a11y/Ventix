const { z } = require('zod');

const TIPOS_DESCUENTO = ['PORCENTAJE', 'MONTO_FIJO'];

// Duplicado a propósito en vez de importar de Ventas (ventas.validators.js#descuentoManualSchema)
// — Compras es un módulo distinto y §3.1 prohíbe que los módulos se importen entre sí; es el
// mismo esquema (tipo/valor con el mismo tope de 100% para PORCENTAJE) pero sin la exigencia de
// autorización de supervisor que sí tiene el de Ventas (acá no aplica, ver crear() más abajo).
const descuentoManualSchema = z
  .object({
    tipo: z.enum(TIPOS_DESCUENTO),
    valor: z.coerce.number().positive(),
  })
  .refine((d) => d.tipo !== 'PORCENTAJE' || d.valor <= 100, {
    message: 'El porcentaje debe estar entre 0 y 100.',
    path: ['valor'],
  });

const crearCompraSchema = z.object({
  sucursalId: z.string().min(1),
  proveedorId: z.string().min(1),
  folioProveedor: z.string().trim().max(100).optional(),
  observaciones: z.string().trim().max(500).optional(),
  // Recepción de una Orden de Compra — siempre opcional (ver "Órdenes de compra" en el README),
  // una Compra puede seguir registrándose sin ninguna orden detrás.
  ordenCompraId: z.string().min(1).optional(),
  detalles: z
    .array(
      z.object({
        articuloId: z.string().min(1),
        unidadId: z.string().min(1),
        cantidad: z.coerce.number().positive(),
        costo: z.coerce.number().nonnegative(),
        // Sin catálogo de descuentos/promociones (Compras no lo tiene) — solo este descuento
        // manual por línea, mismo patrón que Cotizaciones. Sin permiso para cargarse: quien
        // puede registrar una compra puede aplicarle un descuento del proveedor.
        descuentoManual: descuentoManualSchema.optional(),
      }),
    )
    .min(1),
});

module.exports = { crearCompraSchema };
