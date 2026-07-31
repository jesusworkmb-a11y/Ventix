const { z } = require('zod');

const TIPOS = ['PRODUCTO', 'SERVICIO'];

const crearArticuloSchema = z.object({
  tipo: z.enum(TIPOS),
  clave: z.string().optional(),
  sku: z.string().optional(),
  codigoBarras: z.string().optional(),
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
  categoriaId: z.string().min(1).optional(),
  marcaId: z.string().min(1).optional(),
  unidadBaseId: z.string().min(1),
  impuestoId: z.string().min(1).optional(),
  costo: z.coerce.number().min(0).optional(),
  precio: z.coerce.number().min(0).optional(),
  stockMinimo: z.coerce.number().min(0).optional(),
  stockMaximo: z.coerce.number().min(0).optional(),
  imagenUrl: z.string().url().optional(),
});

const actualizarArticuloSchema = crearArticuloSchema.partial().extend({
  activo: z.boolean().optional(),
});

const unidadesAlternasSchema = z.object({
  unidadesAlternas: z.array(
    z.object({
      unidadId: z.string().min(1),
      factor: z.coerce.number().positive(),
    }),
  ),
});

const preciosSchema = z.object({
  precios: z.array(
    z.object({
      listaPrecioId: z.string().min(1),
      precio: z.coerce.number().min(0),
    }),
  ),
});

module.exports = {
  crearArticuloSchema,
  actualizarArticuloSchema,
  unidadesAlternasSchema,
  preciosSchema,
};
