const AppError = require('../errors/AppError');

// Único punto de escritura de MovimientoCaja del proyecto — usado por Caja (INGRESO/RETIRO
// manuales) y por Ventas (VENTA/DEVOLUCION contra la sesión abierta), mismo patrón que
// aplicarMovimiento en shared/services/inventario.service.js. SIEMPRE se llama con el tx de
// la transacción del documento que origina el movimiento.
//
// El SELECT ... FOR UPDATE bloquea la fila de la sesión hasta que el tx termina: así, un
// registro de movimiento concurrente con un cierre (sesiones.service.js#cerrar, que toma el
// mismo lock) queda serializado en vez de correr en paralelo — sin el lock, un movimiento
// podía insertarse justo entre la lectura de movimientos y el UPDATE del cierre, quedando
// fuera del saldoEsperado calculado (verificado en vivo en QA de Caja: 15 movimientos
// concurrentes con un cierre, saldoEsperado solo contó 12).
async function registrarMovimientoCaja(tx, {
  empresaId,
  sesionCajaId,
  tipo,
  monto,
  motivo = null,
  referenciaTipo = null,
  referenciaId = null,
  usuarioId,
  autorizadoPorId = null,
}) {
  // id es TEXT, no uuid nativo (uuid() de Prisma es un default generado en cliente) — sin cast.
  const [sesion] = await tx.$queryRaw`
    SELECT id, caja_id AS "cajaId", fondo_inicial AS "fondoInicial", cerrada_en AS "cerradaEn"
    FROM sesiones_caja WHERE id = ${sesionCajaId} FOR UPDATE
  `;
  if (!sesion) throw new AppError(404, 'Sesión de caja no encontrada.');

  const caja = await tx.caja.findFirst({ where: { id: sesion.cajaId, empresaId } });
  if (!caja) throw new AppError(404, 'Sesión de caja no encontrada.');

  if (sesion.cerradaEn) throw new AppError(400, 'La sesión de caja indicada no está abierta.');

  const movimiento = await tx.movimientoCaja.create({
    data: { sesionCajaId, tipo, monto, motivo, referenciaTipo, referenciaId, usuarioId, autorizadoPorId },
  });

  return { sesion, caja, movimiento };
}

module.exports = { registrarMovimientoCaja };
