const { z } = require('zod');

const abrirSesionSchema = z.object({
  cajaId: z.string().min(1),
  fondoInicial: z.coerce.number().nonnegative(),
});

const cerrarSesionSchema = z.object({
  saldoReal: z.coerce.number().nonnegative(),
});

// VENTA/DEVOLUCION quedan fuera a propósito: los va a escribir el módulo de Ventas (Fase 7)
// directo contra la sesión, no a través de este endpoint de usuario.
const movimientoSchema = z.object({
  tipo: z.enum(['INGRESO', 'RETIRO']),
  monto: z.coerce.number().positive(),
  motivo: z.string().optional(),
  autorizadoPorId: z.string().min(1).optional(),
});

module.exports = { abrirSesionSchema, cerrarSesionSchema, movimientoSchema };
