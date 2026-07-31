const AppError = require('../errors/AppError');

// Único punto de escritura de MovimientoCaja del proyecto — usado por Caja (INGRESO/RETIRO
// manuales) y por Ventas (VENTA/DEVOLUCION contra la sesión abierta), mismo patrón que
// aplicarMovimiento en shared/services/inventario.service.js. SIEMPRE se llama con el tx de
// la transacción del documento que origina el movimiento.
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
  const sesion = await tx.sesionCaja.findUnique({ where: { id: sesionCajaId } });
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
