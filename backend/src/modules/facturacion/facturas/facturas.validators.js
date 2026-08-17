const { z } = require('zod');

const rfcSchema = z
  .string()
  .trim()
  .regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i, 'RFC con formato inválido.')
  .transform((v) => v.toUpperCase());

const receptorSchema = z.object({
  clienteId: z.string().min(1).optional(),
  rfc: rfcSchema,
  nombre: z.string().min(1),
  regimenFiscal: z.string().min(1),
  usoCfdi: z.string().min(1),
  domicilioFiscalCp: z.string().min(1),
});

const impuestoConceptoSchema = z.object({
  impuestoClaveSat: z.enum(['001', '002', '003']),
  tipoFactorSat: z.enum(['Tasa', 'Cuota', 'Exento']),
  tasaOCuota: z.coerce.number().min(0).optional(),
});

const conceptoDirectaSchema = z.object({
  articuloId: z.string().min(1).optional(),
  claveProdServSat: z.string().min(1),
  claveUnidadSat: z.string().min(1),
  descripcion: z.string().min(1),
  cantidad: z.coerce.number().positive(),
  valorUnitario: z.coerce.number().min(0),
  descuento: z.coerce.number().min(0).default(0),
  objetoImpuesto: z.enum(['01', '02', '03', '04']),
  impuesto: impuestoConceptoSchema.optional(),
});

const crearDirectaSchema = z.object({
  sucursalId: z.string().min(1),
  receptor: receptorSchema,
  conceptos: z.array(conceptoDirectaSchema).min(1, 'Agregá al menos un concepto.'),
  formaPago: z.string().min(1),
  metodoPago: z.enum(['PUE', 'PPD']).default('PUE'),
  moneda: z.string().min(1).default('MXN'),
  tipoCambio: z.coerce.number().positive().optional(),
});

const crearDesdeVentaSchema = z.object({
  ventaId: z.string().min(1),
  receptor: receptorSchema,
});

const informacionGlobalSchema = z.object({
  periodicidad: z.enum(['01', '02', '03', '04', '05']),
  meses: z.string().min(1),
  anio: z.coerce.number().int().min(2000),
});

const crearAgrupadaSchema = z
  .object({
    tipo: z.enum(['GLOBAL', 'CONSOLIDADA_CLIENTE']),
    sucursalId: z.string().min(1),
    ventaIds: z.array(z.string().min(1)).min(1, 'Seleccioná al menos una venta.'),
    receptor: receptorSchema,
    informacionGlobal: informacionGlobalSchema.optional(),
  })
  .superRefine((datos, ctx) => {
    if (datos.tipo === 'GLOBAL' && !datos.informacionGlobal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La factura global exige indicar periodicidad/mes/año.',
        path: ['informacionGlobal'],
      });
    }
  });

const cancelarSchema = z
  .object({
    claveMotivoCancelacion: z.enum(['01', '02', '03', '04']),
    facturaSustitutaId: z.string().min(1).optional(),
  })
  .superRefine((datos, ctx) => {
    if (datos.claveMotivoCancelacion === '01' && !datos.facturaSustitutaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El motivo "01" exige indicar la factura que sustituye a esta.',
        path: ['facturaSustitutaId'],
      });
    }
  });

const ventasFacturablesSchema = z.object({
  sucursalId: z.string().min(1),
  clienteId: z.string().min(1).optional(),
  soloPublicoGeneral: z.coerce.boolean().optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
});

const sugerenciaSchema = z.object({
  sucursalId: z.string().min(1),
  clienteId: z.string().min(1),
});

module.exports = {
  receptorSchema,
  crearDirectaSchema,
  crearDesdeVentaSchema,
  crearAgrupadaSchema,
  cancelarSchema,
  ventasFacturablesSchema,
  sugerenciaSchema,
};
