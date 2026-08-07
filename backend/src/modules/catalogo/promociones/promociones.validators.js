const { z } = require('zod');

// A diferencia de Descuento, una promoción NxM no tiene sentido sin un producto/categoría
// concreto — no se permite alcance TODOS acá.
const ALCANCES_PROMOCION = ['CATEGORIA', 'ARTICULO'];

function validarCruces(datos, ctx) {
  if (datos.alcance === 'CATEGORIA' && !datos.categoriaId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecciona una categoría para este alcance.', path: ['categoriaId'] });
  }
  if (datos.alcance === 'ARTICULO' && !datos.articuloId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecciona un artículo para este alcance.', path: ['articuloId'] });
  }
  if (
    datos.cantidadRequerida !== undefined &&
    datos.cantidadGratis !== undefined &&
    datos.cantidadGratis >= datos.cantidadRequerida
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La cantidad gratis debe ser menor a la cantidad requerida (ej. 2x1: requerida=2, gratis=1).',
      path: ['cantidadGratis'],
    });
  }
}

const crearPromocionSchema = z
  .object({
    nombre: z.string().min(1),
    alcance: z.enum(ALCANCES_PROMOCION),
    categoriaId: z.string().min(1).optional(),
    articuloId: z.string().min(1).optional(),
    cantidadRequerida: z.coerce.number().int().positive(),
    cantidadGratis: z.coerce.number().int().positive(),
    requiereAprobacion: z.boolean().optional(),
    activo: z.boolean().optional(),
    vigenciaDesde: z.coerce.date().optional(),
    vigenciaHasta: z.coerce.date().optional(),
  })
  .superRefine(validarCruces);

const actualizarPromocionSchema = z
  .object({
    nombre: z.string().min(1).optional(),
    alcance: z.enum(ALCANCES_PROMOCION).optional(),
    categoriaId: z.string().min(1).nullable().optional(),
    articuloId: z.string().min(1).nullable().optional(),
    cantidadRequerida: z.coerce.number().int().positive().optional(),
    cantidadGratis: z.coerce.number().int().positive().optional(),
    requiereAprobacion: z.boolean().optional(),
    activo: z.boolean().optional(),
    vigenciaDesde: z.coerce.date().nullable().optional(),
    vigenciaHasta: z.coerce.date().nullable().optional(),
  })
  .superRefine(validarCruces);

module.exports = { crearPromocionSchema, actualizarPromocionSchema };
