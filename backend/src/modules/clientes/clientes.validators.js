const { z } = require('zod');

// esGeneral NO es aceptado desde el cliente HTTP: lo maneja el sistema (ver asegurarClienteGeneral).
const crearClienteSchema = z.object({
  nombre: z.string().min(1),
  telefono: z.string().optional(),
  correo: z.string().email().optional(),
  rfc: z.string().optional(),
  direccion: z.string().optional(),
  listaPrecioId: z.string().min(1).optional(),
});

const actualizarClienteSchema = crearClienteSchema.partial().extend({
  activo: z.boolean().optional(),
  // A diferencia de crear (donde omitir el campo alcanza), actualizar necesita poder
  // desasignar explícitamente una lista de precio ya asignada -> acepta null además de
  // string/undefined.
  listaPrecioId: z.string().min(1).nullable().optional(),
});

module.exports = { crearClienteSchema, actualizarClienteSchema };
