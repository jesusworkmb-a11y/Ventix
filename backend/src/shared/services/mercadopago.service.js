const crypto = require('crypto');
const AppError = require('../errors/AppError');

// Punto único de integración con Mercado Pago (Checkout Pro), mismo criterio que
// facturama.service.js: acá vive todo lo que habla con el proveedor externo. Sin SDK a propósito
// (son 2 llamadas REST, no justifica una dependencia más). Credenciales de prueba vs. producción
// es solo cambiar MP_ACCESS_TOKEN (TEST-... vs APP_USR-...), sin tocar este archivo.
const API = 'https://api.mercadopago.com';

function accessToken() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new AppError(500, 'Los pagos en línea no están configurados en el servidor.');
  return token;
}

async function llamar(metodo, ruta, body) {
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${accessToken()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  if (!res.ok) {
    console.error(`Mercado Pago ${metodo} ${ruta} -> ${res.status}: ${texto}`); // eslint-disable-line no-console
    throw new AppError(502, 'No se pudo comunicar con Mercado Pago. Intenta de nuevo en unos minutos.');
  }
  return texto ? JSON.parse(texto) : null;
}

// Preferencia de Checkout Pro: el cliente paga en la página de Mercado Pago y vuelve a
// `urlRetorno`. `referencia` (PagoSuscripcion.id) viaja como external_reference y vuelve en el
// pago — es lo que liga el cobro de MP con nuestra fila, nunca el monto ni el correo.
async function crearPreferencia({
  referencia, titulo, monto, urlRetorno, urlNotificacion,
}) {
  const preferencia = await llamar('POST', '/checkout/preferences', {
    items: [{
      id: 'suscripcion-mensual',
      title: titulo,
      quantity: 1,
      unit_price: Number(monto),
      currency_id: 'MXN',
    }],
    external_reference: referencia,
    notification_url: urlNotificacion,
    back_urls: { success: urlRetorno, pending: urlRetorno, failure: urlRetorno },
    auto_return: 'approved',
    statement_descriptor: 'BOX POS',
  });
  return { id: preferencia.id, initPoint: preferencia.init_point };
}

// La fuente de verdad de un pago es SIEMPRE esta consulta a la API con nuestro access token —
// nunca el cuerpo de la notificación ni los query params de la URL de retorno, que cualquiera
// puede fabricar.
function obtenerPago(pagoId) {
  return llamar('GET', `/v1/payments/${encodeURIComponent(pagoId)}`);
}

// Valida el header x-signature de una notificación (webhooks de MP): HMAC-SHA256 con la clave
// secreta del panel de la aplicación sobre "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
// Defensa adicional, no la única: aunque pasara una notificación falsa, el pago igual se
// re-consulta a la API (obtenerPago) antes de aplicar nada. Devuelve null si no se puede validar
// (sin secreto configurado, o notificación sin header — no está garantizado que MP lo mande en
// las que llegan por notification_url), true/false si sí. Solo un header presente y mal firmado
// es motivo de rechazo.
function firmaValida({ xSignature, xRequestId, dataId }) {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!secreto || !xSignature) return null;

  const partes = Object.fromEntries(
    xSignature.split(',').map((p) => p.split('=').map((s) => s.trim())),
  );
  const { ts, v1 } = partes;
  if (!ts || !v1) return false;

  let manifiesto = '';
  if (dataId) manifiesto += `id:${String(dataId).toLowerCase()};`;
  if (xRequestId) manifiesto += `request-id:${xRequestId};`;
  manifiesto += `ts:${ts};`;

  const esperado = crypto.createHmac('sha256', secreto).update(manifiesto).digest('hex');
  const a = Buffer.from(esperado);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { crearPreferencia, obtenerPago, firmaValida };
