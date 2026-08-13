const { z } = require('zod');

const crearSucursalSchema = z.object({
  nombre: z.string().min(1),
  clave: z.string().min(1),
  telefono: z.string().optional(),
  correo: z.string().email().optional(),
  direccion: z.string().optional(),
  responsable: z.string().optional(),
});

const actualizarSucursalSchema = z
  .object({
    nombre: z.string().min(1),
    telefono: z.string().optional(),
    correo: z.string().email().optional(),
    direccion: z.string().optional(),
    responsable: z.string().optional(),
    estado: z.enum(['ACTIVA', 'SUSPENDIDA', 'ARCHIVADA']),
  })
  .partial();

// Fiscal, gateado con administracion.fiscal.editar (mismo criterio que empresa.validators.js):
// campos nullable = "hereda de Empresa" (comportamiento matriz), enviar null limpia el override.
const actualizarFiscalSucursalSchema = z
  .object({
    rfc: z.string().min(1).nullable(),
    razonSocial: z.string().min(1).nullable(),
    regimenFiscalClave: z.string().min(1).nullable(),
    codigoPostal: z.string().min(1).nullable(),
  })
  .partial();

module.exports = { crearSucursalSchema, actualizarSucursalSchema, actualizarFiscalSucursalSchema };
