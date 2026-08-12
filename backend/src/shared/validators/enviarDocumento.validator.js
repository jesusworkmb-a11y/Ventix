const { z } = require('zod');

// Schema reusado por los 4 endpoints "enviar por correo" (cotizaciones, compras, ventas/ticket,
// reportes) — el límite real de tamaño del adjunto lo impone el body limit de Express (app.js),
// acá solo se valida forma.
const enviarDocumentoSchema = z.object({
  destinatario: z.string().email('Correo de destino inválido.'),
  asunto: z.string().max(200).optional(),
  mensaje: z.string().max(1000).optional(),
  adjuntoBase64: z.string().min(1, 'Falta el archivo adjunto.'),
  nombreArchivo: z.string().min(1).max(150),
});

module.exports = { enviarDocumentoSchema };
