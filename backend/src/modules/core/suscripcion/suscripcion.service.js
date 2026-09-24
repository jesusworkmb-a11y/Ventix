const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const mercadopago = require('../../../shared/services/mercadopago.service');

// Precio público de BOX POS (ver /precios en boxpos-web): un solo plan, mes a mes, sin
// permanencia. String, no number, porque va directo a un campo Decimal (ver shared/decimal.js).
const PRECIO_MENSUAL = '499.00';
const MESES_POR_PAGO = 1;

// Suma meses de calendario sin desbordar al mes siguiente: 31/ene + 1 mes = 28/feb (o 29), no
// 3/mar como haría setUTCMonth a secas.
function sumarMeses(fecha, meses) {
  const d = new Date(fecha);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimoDia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimoDia));
  return d;
}

const SELECT_PAGO = {
  id: true, meses: true, monto: true, moneda: true, estado: true, mpEstado: true,
  vigenciaAnterior: true, vigenciaNueva: true, creadoEn: true, aplicadoEn: true,
};

async function obtenerResumen({ empresaId }) {
  const [empresa, pagos] = await Promise.all([
    prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { nombreComercial: true, plan: true, vigenciaHasta: true },
    }),
    prisma.pagoSuscripcion.findMany({
      // PENDIENTE sin mpEstado = checkout abierto y abandonado (nunca llegó a Mercado Pago):
      // ruido, no se muestra. Con mpEstado sí (ej. pago en efectivo esperando acreditarse).
      where: { empresaId, OR: [{ estado: { not: 'PENDIENTE' } }, { mpEstado: { not: null } }] },
      orderBy: { creadoEn: 'desc' },
      take: 12,
      select: SELECT_PAGO,
    }),
  ]);
  return {
    ...empresa, precioMensual: PRECIO_MENSUAL, pagosEnLinea: !!process.env.MP_ACCESS_TOKEN, pagos,
  };
}

async function iniciarCheckout({
  empresaId, usuarioId, urlRetornoBase, urlNotificacion,
}) {
  if (!process.env.MP_ACCESS_TOKEN) {
    throw new AppError(503, 'Los pagos en línea todavía no están disponibles.');
  }
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId }, select: { nombreComercial: true, vigenciaHasta: true },
  });
  // null = empresa sin vencimiento (la gestiona el superadmin a mano): no hay nada que pagar, y
  // aplicar un pago la convertiría en una empresa con vencimiento.
  if (!empresa.vigenciaHasta) {
    throw new AppError(400, 'Tu empresa no tiene una fecha de vencimiento, no hace falta pagar.');
  }

  const pago = await prisma.pagoSuscripcion.create({
    data: { empresaId, usuarioId, meses: MESES_POR_PAGO, monto: PRECIO_MENSUAL },
  });
  const preferencia = await mercadopago.crearPreferencia({
    referencia: pago.id,
    titulo: `BOX POS — 1 mes (${empresa.nombreComercial})`,
    monto: PRECIO_MENSUAL,
    urlRetorno: `${urlRetornoBase}?pago=${pago.id}`,
    urlNotificacion,
  });
  await prisma.pagoSuscripcion.update({
    where: { id: pago.id }, data: { mpPreferenciaId: preferencia.id },
  });
  return { pagoId: pago.id, initPoint: preferencia.initPoint };
}

// Aplica un pago consultado a la API de Mercado Pago (nunca datos de la notificación o de la URL
// de retorno, ver mercadopago.service#obtenerPago). Idempotente y seguro bajo concurrencia: el
// webhook y la conciliación desde la URL de retorno pueden llegar casi al mismo tiempo, y MP
// reintenta notificaciones — solo el primero que reclama la fila (UPDATE...WHERE PENDIENTE)
// extiende la vigencia, mismo patrón que cotizaciones/transferencias/compras.
async function aplicarPagoMercadoPago(mpPago) {
  const pagoId = mpPago?.external_reference;
  if (!pagoId) return null;
  const pago = await prisma.pagoSuscripcion.findUnique({ where: { id: pagoId } });
  if (!pago) return null;

  const mpEstado = [mpPago.status, mpPago.status_detail].filter(Boolean).join('/');

  if (mpPago.status === 'approved') {
    // El monto/moneda cobrados deben cubrir lo que pedimos: la preferencia la armamos nosotros,
    // pero se valida igual en vez de confiar en que nadie la alteró.
    if (mpPago.currency_id !== pago.moneda || Number(mpPago.transaction_amount) < Number(pago.monto)) {
      console.error(`Pago MP ${mpPago.id} no coincide con PagoSuscripcion ${pago.id}`); // eslint-disable-line no-console
      await prisma.pagoSuscripcion.updateMany({
        where: { id: pago.id, estado: 'PENDIENTE' },
        data: { mpEstado: `monto_no_coincide:${mpPago.transaction_amount} ${mpPago.currency_id}` },
      });
      return prisma.pagoSuscripcion.findUnique({ where: { id: pago.id }, select: SELECT_PAGO });
    }

    await prisma.$transaction(async (tx) => {
      // Reclama también desde RECHAZADO: en Checkout Pro el cliente puede reintentar con otra
      // tarjeta en la misma preferencia tras un rechazo — llega un segundo pago de MP (otro id,
      // misma external_reference) que sí trae el dinero y no debe quedar sin aplicar.
      const reclamado = await tx.pagoSuscripcion.updateMany({
        where: { id: pago.id, estado: { in: ['PENDIENTE', 'RECHAZADO'] } },
        data: {
          estado: 'APROBADO', mpPagoId: String(mpPago.id), mpEstado, aplicadoEn: new Date(),
        },
      });
      if (reclamado.count === 0) return; // ya aplicado (o rechazado) por otra llamada

      // FOR UPDATE: serializa contra el superadmin editando la vigencia a mano o dos pagos
      // distintos de la misma empresa aplicándose a la vez — cada uno suma sobre el anterior.
      const [empresa] = await tx.$queryRaw`
        SELECT vigencia_hasta FROM empresas WHERE id = ${pago.empresaId} FOR UPDATE`;
      const anterior = empresa.vigencia_hasta;
      // Si paga antes de vencer, conserva los días que le quedaban; si ya venció, cuenta desde hoy.
      const ahora = new Date();
      const base = anterior && anterior > ahora ? anterior : ahora;
      const nueva = sumarMeses(base, pago.meses);

      await tx.empresa.update({ where: { id: pago.empresaId }, data: { vigenciaHasta: nueva } });
      await tx.pagoSuscripcion.update({
        where: { id: pago.id }, data: { vigenciaAnterior: anterior, vigenciaNueva: nueva },
      });
      await registrarAuditoria(tx, {
        empresaId: pago.empresaId,
        usuarioEjecutorId: pago.usuarioId,
        accion: 'ACTUALIZAR',
        entidad: 'Empresa',
        entidadId: pago.empresaId,
        motivo: `Pago de suscripción con Mercado Pago (pago ${mpPago.id})`,
        valoresAntes: { vigenciaHasta: anterior ? anterior.toISOString() : null },
        valoresDespues: { vigenciaHasta: nueva.toISOString() },
      });
    });
  } else if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(mpPago.status)) {
    await prisma.pagoSuscripcion.updateMany({
      where: { id: pago.id, estado: 'PENDIENTE' },
      data: { estado: 'RECHAZADO', mpPagoId: String(mpPago.id), mpEstado },
    });
  } else {
    // pending / in_process / authorized: todavía no hay dinero, solo se deja rastro del estado.
    await prisma.pagoSuscripcion.updateMany({
      where: { id: pago.id, estado: 'PENDIENTE' }, data: { mpEstado },
    });
  }

  return prisma.pagoSuscripcion.findUnique({ where: { id: pago.id }, select: SELECT_PAGO });
}

// Estado de un pago para la pantalla de retorno. Si llega con el id de pago de MP (query param
// payment_id que agrega MP a la URL de retorno) y todavía está PENDIENTE, concilia en el momento
// contra la API en vez de esperar al webhook — que puede tardar o, en pruebas, no llegar.
async function obtenerPago({ empresaId, pagoId, mpPagoId }) {
  const pago = await prisma.pagoSuscripcion.findFirst({
    where: { id: pagoId, empresaId }, select: SELECT_PAGO,
  });
  if (!pago) throw new AppError(404, 'Pago no encontrado.');

  if (pago.estado !== 'APROBADO' && mpPagoId) {
    const mpPago = await mercadopago.obtenerPago(mpPagoId);
    // El pago de MP debe ser de ESTE registro: sin esto, cualquiera podría pasar el id de un
    // pago aprobado ajeno (de otra empresa) en la URL.
    if (mpPago.external_reference === pago.id) {
      return aplicarPagoMercadoPago(mpPago);
    }
  }
  return pago;
}

// Notificación de Mercado Pago (endpoint público). Solo interesa type=payment; el resto
// (merchant_order, etc.) se ignora. Siempre re-consulta el pago a la API.
async function procesarNotificacion({ tipo, dataId }) {
  if (tipo !== 'payment' || !dataId) return;
  const mpPago = await mercadopago.obtenerPago(dataId);
  await aplicarPagoMercadoPago(mpPago);
}

module.exports = {
  obtenerResumen, iniciarCheckout, obtenerPago, procesarNotificacion, sumarMeses, PRECIO_MENSUAL,
};
