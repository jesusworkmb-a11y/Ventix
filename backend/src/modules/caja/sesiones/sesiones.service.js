const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const { registrarMovimientoCaja } = require('../../../shared/services/caja.service');
const toJson = require('../../../shared/toJson');

// SesionCaja no tiene empresaId propio — se valida pertenencia yendo a través de su Caja.
async function obtenerSesionValidada({ empresaId, sesionId }) {
  const sesion = await prisma.sesionCaja.findUnique({ where: { id: sesionId } });
  if (!sesion) throw new AppError(404, 'Sesión de caja no encontrada.');
  const caja = await prisma.caja.findFirst({ where: { id: sesion.cajaId, empresaId } });
  if (!caja) throw new AppError(404, 'Sesión de caja no encontrada.');
  return { sesion, caja };
}

async function listar({ empresaId, filtros }) {
  const cajasEmpresa = await prisma.caja.findMany({ where: { empresaId }, select: { id: true } });
  const cajaIds = cajasEmpresa.map((c) => c.id);

  const where = { cajaId: { in: cajaIds } };
  if (filtros.cajaId) where.cajaId = filtros.cajaId;
  if (filtros.abierta === 'true') where.cerradaEn = null;
  if (filtros.abierta === 'false') where.cerradaEn = { not: null };

  return prisma.sesionCaja.findMany({ where, orderBy: { abiertaEn: 'desc' }, take: 200 });
}

async function obtener({ empresaId, sesionId }) {
  const { sesion } = await obtenerSesionValidada({ empresaId, sesionId });
  const movimientos = await prisma.movimientoCaja.findMany({
    where: { sesionCajaId: sesionId },
    orderBy: { creadoEn: 'asc' },
  });
  return { ...sesion, movimientos };
}

async function abrir({ empresaId, usuarioId, cajaId, fondoInicial }) {
  const caja = await prisma.caja.findFirst({ where: { id: cajaId, empresaId } });
  if (!caja) throw new AppError(400, 'La caja indicada no pertenece a esta empresa.');

  const abierta = await prisma.sesionCaja.findFirst({ where: { cajaId, cerradaEn: null } });
  if (abierta) throw new AppError(409, 'Esta caja ya tiene una sesión abierta.');

  return prisma.$transaction(async (tx) => {
    const sesion = await tx.sesionCaja.create({
      data: { cajaId, usuarioResponsableId: usuarioId, fondoInicial },
    });
    await registrarAuditoria(tx, {
      empresaId,
      sucursalId: caja.sucursalId,
      usuarioEjecutorId: usuarioId,
      accion: 'CREAR',
      entidad: 'SesionCaja',
      entidadId: sesion.id,
      valoresDespues: toJson(sesion),
    });
    return sesion;
  });
}

async function registrarMovimiento({ empresaId, usuarioId, sesionId, tipo, monto, motivo, autorizadoPorId }) {
  const { caja } = await obtenerSesionValidada({ empresaId, sesionId });

  if (autorizadoPorId) {
    const autorizador = await prisma.usuarioEmpresa.findUnique({
      where: { usuarioId_empresaId: { usuarioId: autorizadoPorId, empresaId } },
    });
    if (!autorizador) throw new AppError(400, 'El usuario autorizador indicado no pertenece a esta empresa.');
  }

  return prisma.$transaction(async (tx) => {
    const { movimiento } = await registrarMovimientoCaja(tx, {
      empresaId,
      sesionCajaId: sesionId,
      tipo,
      monto,
      motivo,
      usuarioId,
      autorizadoPorId,
    });
    await registrarAuditoria(tx, {
      empresaId,
      sucursalId: caja.sucursalId,
      usuarioEjecutorId: usuarioId,
      usuarioAutorizadorId: autorizadoPorId || null,
      accion: 'CREAR',
      entidad: 'MovimientoCaja',
      entidadId: movimiento.id,
      motivo,
      valoresDespues: toJson(movimiento),
    });
    return movimiento;
  });
}

// Signo por tipo ya incluye VENTA/DEVOLUCION aunque este módulo todavía no los escribe —
// cuando Ventas (Fase 7) empiece a crearlos contra la sesión, el cierre ya los suma bien
// sin tocar esta función (mismo criterio que DIRECCION_POR_TIPO en inventario.service.js).
const SIGNO_POR_TIPO = { INGRESO: 1, VENTA: 1, RETIRO: -1, DEVOLUCION: -1 };

async function cerrar({ empresaId, usuarioId, sesionId, saldoReal }) {
  const { sesion, caja } = await obtenerSesionValidada({ empresaId, sesionId });
  if (sesion.cerradaEn) throw new AppError(400, 'La sesión ya está cerrada.');

  const movimientos = await prisma.movimientoCaja.findMany({ where: { sesionCajaId: sesionId } });
  const saldoEsperado = movimientos.reduce(
    (acc, m) => acc + Number(m.monto) * (SIGNO_POR_TIPO[m.tipo] || 0),
    Number(sesion.fondoInicial),
  );
  const diferencia = saldoReal - saldoEsperado;

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.sesionCaja.update({
      where: { id: sesionId },
      data: { cerradaEn: new Date(), saldoEsperado, saldoReal, diferencia },
    });
    await registrarAuditoria(tx, {
      empresaId,
      sucursalId: caja.sucursalId,
      usuarioEjecutorId: usuarioId,
      accion: 'ACTUALIZAR',
      entidad: 'SesionCaja',
      entidadId: sesionId,
      valoresDespues: toJson({ saldoEsperado, saldoReal, diferencia }),
    });
    return actualizada;
  });
}

module.exports = { listar, obtener, abrir, cerrar, registrarMovimiento };
