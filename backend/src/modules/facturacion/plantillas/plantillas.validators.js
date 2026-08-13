const { z } = require('zod');

const conceptoPlantillaSchema = z.object({
  articuloId: z.string().min(1),
  cantidadHabitual: z.coerce.number().positive(),
});

const listarSchema = z.object({
  sucursalId: z.string().min(1),
  clienteId: z.string().min(1),
});

const crearSchema = z.object({
  sucursalId: z.string().min(1),
  clienteId: z.string().min(1),
  nombre: z.string().min(1),
  esPredeterminada: z.boolean().default(false),
  formaPago: z.string().min(1).optional(),
  metodoPago: z.enum(['PUE', 'PPD']).optional(),
  conceptos: z.array(conceptoPlantillaSchema).min(1, 'Agregá al menos un concepto.'),
});

const actualizarSchema = z.object({
  nombre: z.string().min(1).optional(),
  esPredeterminada: z.boolean().optional(),
});

module.exports = { listarSchema, crearSchema, actualizarSchema };
