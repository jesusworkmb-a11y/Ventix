const AppError = require('../../../shared/errors/AppError');
const mercadopago = require('../../../shared/services/mercadopago.service');
const service = require('./suscripcion.service');

async function obtenerResumen(req, res) {
  res.json(await service.obtenerResumen({ empresaId: req.auth.empresaId }));
}

async function iniciarCheckout(req, res) {
  // Mercado Pago solo acepta notification_url pública por HTTPS: en local (http://localhost) se
  // omite y el pago se concilia al volver a la pantalla de suscripción (ver obtenerPago).
  const urlBackend = `${req.protocol}://${req.get('host')}`;
  const resultado = await service.iniciarCheckout({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    urlRetornoBase: `${process.env.FRONTEND_URL}/suscripcion`,
    urlNotificacion: urlBackend.startsWith('https://')
      ? `${urlBackend}/api/core/suscripcion/webhook`
      : undefined,
  });
  res.status(201).json(resultado);
}

async function obtenerPago(req, res) {
  const mpPagoId = typeof req.query.paymentId === 'string' && /^\d+$/.test(req.query.paymentId)
    ? req.query.paymentId
    : null;
  res.json(await service.obtenerPago({
    empresaId: req.auth.empresaId, pagoId: req.params.id, mpPagoId,
  }));
}

// Endpoint público llamado por Mercado Pago. Formato de webhooks: ?type=payment&data.id=123
// (query) y/o {type, data: {id}} (body). Responder 2xx rápido; si algo falla al procesar, 500 para
// que MP reintente más tarde (aplicarPagoMercadoPago es idempotente, reintentar es seguro).
async function webhook(req, res) {
  const tipo = req.query.type || req.body?.type;
  const dataId = req.query['data.id'] || req.body?.data?.id;

  const firma = mercadopago.firmaValida({
    xSignature: req.get('x-signature'),
    xRequestId: req.get('x-request-id'),
    dataId,
  });
  if (firma === false) throw new AppError(401, 'Firma inválida.');

  await service.procesarNotificacion({ tipo, dataId });
  res.sendStatus(200);
}

module.exports = {
  obtenerResumen, iniciarCheckout, obtenerPago, webhook,
};
