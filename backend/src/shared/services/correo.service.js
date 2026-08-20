const { Resend } = require('resend');
const AppError = require('../errors/AppError');

// Punto único de integración con el proveedor de email (Resend), compartido por los módulos
// que envían documentos por correo (cotizaciones, compras, ventas, reportes) — mismo criterio
// que caja.service.js/secuencia.service.js/auditoria.service.js: un solo lugar que sabe cómo
// hablar con el sistema externo, cada módulo solo arma los datos del documento.
async function enviarCorreoConAdjunto({
  destinatario, asunto, mensaje, adjunto,
}) {
  if (!process.env.RESEND_API_KEY) {
    throw new AppError(500, 'El envío de correo no está configurado en el servidor.');
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: destinatario,
    subject: asunto,
    text: mensaje || asunto,
    attachments: [
      {
        filename: adjunto.nombreArchivo,
        content: adjunto.contenidoBase64,
      },
    ],
  });

  if (error) {
    console.error('Error enviando correo con Resend:', error); // eslint-disable-line no-console
    throw new AppError(502, 'No se pudo enviar el correo. Intenta de nuevo.');
  }
}

// Variante sin adjunto, para correos transaccionales de puro texto/HTML (ej. recuperación de
// contraseña) -- enviarCorreoConAdjunto exige un adjunto siempre, no se le cambió la firma para
// no tocar a sus 4 llamadores existentes (cotizaciones/compras/ventas/reportes).
async function enviarCorreo({ destinatario, asunto, mensaje, html }) {
  if (!process.env.RESEND_API_KEY) {
    throw new AppError(500, 'El envío de correo no está configurado en el servidor.');
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: destinatario,
    subject: asunto,
    text: mensaje,
    html: html || undefined,
  });

  if (error) {
    console.error('Error enviando correo con Resend:', error); // eslint-disable-line no-console
    throw new AppError(502, 'No se pudo enviar el correo. Intenta de nuevo.');
  }
}

module.exports = { enviarCorreoConAdjunto, enviarCorreo };
