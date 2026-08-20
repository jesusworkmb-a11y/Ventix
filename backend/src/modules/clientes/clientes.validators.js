const { z } = require('zod');
const { rfcSchema } = require('../../shared/rfc');

// esGeneral NO es aceptado desde el cliente HTTP: lo maneja el sistema (ver asegurarClienteGeneral).
const crearClienteSchema = z.object({
  nombre: z.string().min(1),
  telefono: z.string().optional(),
  correo: z.string().email().optional(),
  // rfcSchema en vez de z.string() suelto: no se validaba formato (encontrado en la ronda de QA
  // pre-lanzamiento) pese a usarse como default para prellenar el receptor al facturar.
  rfc: rfcSchema.optional(),
  direccion: z.string().optional(),
  // Código postal del domicilio fiscal — distinto de `direccion` (contacto general): lo usa
  // Facturación para prellenar el receptor del CFDI (ver receptorDesdeCliente en el frontend).
  domicilioFiscalCp: z.string().optional(),
  // Solo defaults para prellenar el receptor al facturar (mismo criterio que domicilioFiscalCp)
  // — no se validan contra el catálogo CatalogoSat acá, igual que Empresa/Sucursal.
  regimenFiscalClave: z.string().optional(),
  usoCfdiPreferido: z.string().optional(),
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
