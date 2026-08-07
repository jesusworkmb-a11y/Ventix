const { z } = require('zod');

const TIPOS_DESCUENTO = ['PORCENTAJE', 'MONTO_FIJO'];
const ALCANCES_DESCUENTO = ['TODOS', 'CATEGORIA', 'ARTICULO'];

// Solo valida cruces entre campos cuando esos campos vienen en el request (así sirve tanto
// para crear, donde alcance siempre está presente, como para actualizar parcial).
function validarCruces(datos, ctx) {
  if (datos.alcance === 'CATEGORIA' && !datos.categoriaId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecciona una categoría para este alcance.', path: ['categoriaId'] });
  }
  if (datos.alcance === 'ARTICULO' && !datos.articuloId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecciona un artículo para este alcance.', path: ['articuloId'] });
  }
  if (datos.tipo === 'PORCENTAJE' && datos.valor !== undefined && (datos.valor <= 0 || datos.valor > 100)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El porcentaje debe estar entre 0 y 100.', path: ['valor'] });
  }
}

const crearDescuentoSchema = z
  .object({
    nombre: z.string().min(1),
    tipo: z.enum(TIPOS_DESCUENTO),
    valor: z.coerce.number().positive(),
    alcance: z.enum(ALCANCES_DESCUENTO).optional().default('TODOS'),
    categoriaId: z.string().min(1).optional(),
    articuloId: z.string().min(1).optional(),
    requiereAprobacion: z.boolean().optional(),
    activo: z.boolean().optional(),
    vigenciaDesde: z.coerce.date().optional(),
    vigenciaHasta: z.coerce.date().optional(),
  })
  .superRefine(validarCruces);

const actualizarDescuentoSchema = z
  .object({
    nombre: z.string().min(1).optional(),
    tipo: z.enum(TIPOS_DESCUENTO).optional(),
    valor: z.coerce.number().positive().optional(),
    alcance: z.enum(ALCANCES_DESCUENTO).optional(),
    categoriaId: z.string().min(1).nullable().optional(),
    articuloId: z.string().min(1).nullable().optional(),
    requiereAprobacion: z.boolean().optional(),
    activo: z.boolean().optional(),
    vigenciaDesde: z.coerce.date().nullable().optional(),
    vigenciaHasta: z.coerce.date().nullable().optional(),
  })
  .superRefine(validarCruces);

module.exports = { crearDescuentoSchema, actualizarDescuentoSchema };
