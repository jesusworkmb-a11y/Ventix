const { z } = require('zod');
const { rfcSchema } = require('../../../shared/rfc');

// logoUrl viaja como data URI (base64) generada en el navegador — no hay almacenamiento de
// archivos en este backend (mismo criterio que Articulo.imagenUrl, que tampoco lo tiene). El
// frontend ya redimensiona/comprime la imagen antes de mandarla; este máximo es solo un
// resguardo con mensaje claro antes de que lo corte el límite de body de express (ver app.js).
const colorHexSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'El color debe ser un hex válido (ej. #1E3A8A).')
  .nullable()
  .optional();

// §Plantillas de documentos: branding y selección de plantilla PDF, aplican a
// Cotización/Compra/Orden de compra/Factura (ver frontend/src/shared/pdf/plantillas).
const actualizarEmpresaSchema = z.object({
  nombreComercial: z.string().min(1, 'El nombre comercial es obligatorio.'),
  logoUrl: z.string().max(2_000_000, 'El logo es demasiado grande.').nullable().optional(),
  colorPrimario: colorHexSchema,
  colorSecundario: colorHexSchema,
  colorAcento: colorHexSchema,
  plantillaPdf: z.enum(['CLASICA', 'MODERNA', 'EJECUTIVA', 'COMERCIAL', 'CATALOGO', 'PREMIUM']).optional(),
  datosBancarios: z.string().max(2000).nullable().optional(),
  terminosCondicionesPdf: z.string().max(4000).nullable().optional(),
});

// Separado del PATCH general de arriba a propósito: el RFC/razón social/régimen fiscal es
// dato legal sensible para CFDI, distinto en severidad de cambiar el nombre comercial/logo —
// se gatea con su propio permiso (administracion.fiscal.editar) en vez de reusar
// administracion.empresa.editar. rfc/razonSocial ya existían en el modelo pero nunca tuvieron
// UI ni endpoint propio hasta ahora (solo nombreComercial/logoUrl eran editables).
const actualizarFiscalEmpresaSchema = z.object({
  rfc: rfcSchema.nullable().optional(),
  razonSocial: z.string().min(1).nullable().optional(),
  regimenFiscalClave: z.string().min(1).nullable().optional(),
  // Slug de la URL pública del portal de autofacturación. null = portal apagado para esta empresa.
  slugPublico: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'El slug solo puede tener minúsculas, números y guiones.')
    .min(3)
    .max(60)
    .nullable()
    .optional(),
});

module.exports = { actualizarEmpresaSchema, actualizarFiscalEmpresaSchema };
