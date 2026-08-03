const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const { registrarMovimientoCaja } = require('../../../shared/services/caja.service');
const toJson = require('../../../shared/toJson');
const redondear = require('../../../shared/redondear');

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
  return prisma.$transaction(async (tx) => {
    // FOR UPDATE bloquea la fila de la caja hasta que el tx termina: dos aperturas
    // concurrentes de la misma caja quedan serializadas en vez de correr en paralelo
    // (sin el lock, ambas podían pasar el check de "sin sesión abierta" y crear dos
    // sesiones simultáneas — verificado en vivo en QA de Caja).
    // id/empresa_id son TEXT (uuid() de Prisma es un default generado en cliente, no el tipo
    // nativo uuid de Postgres) — sin cast, comparar contra un parámetro ::uuid revienta con
    // "operator does not exist: text = uuid".
    const [caja] = await tx.$queryRaw`
      SELECT id, sucursal_id AS "sucursalId", activa
      FROM cajas WHERE id = ${cajaId} AND empresa_id = ${empresaId} FOR UPDATE
    `;
    if (!caja) throw new AppError(400, 'La caja indicada no pertenece a esta empresa.');
    // El flag activa no se validaba en ningún punto (solo se podía set/leer vía CRUD de
    // cajas): una caja desactivada por un admin podía seguir abriendo sesiones normalmente,
    // verificado en vivo en QA de Caja — mismo tipo de vacío que el estado BLOQUEADO en Core.
    if (!caja.activa) throw new AppError(400, 'La caja está inactiva.');

    const abierta = await tx.sesionCaja.findFirst({ where: { cajaId, cerradaEn: null } });
    if (abierta) throw new AppError(409, 'Esta caja ya tiene una sesión abierta.');

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
  return prisma.$transaction(async (tx) => {
    // Mismo lock (FOR UPDATE) que toma registrarMovimientoCaja sobre esta sesión: serializa
    // el cierre contra cualquier movimiento concurrente y contra un segundo cierre concurrente.
    // Antes, la lectura de movimientos y el UPDATE del cierre corrían fuera de una transacción
    // compartida con el resto de escrituras contra la sesión, así que dos cierres simultáneos
    // pasaban ambos el check de "no cerrada" y devolvían 200 con saldoEsperado/diferencia
    // distintos (último UPDATE gana) — verificado en vivo en QA de Caja: 4 de 5 cierres
    // concurrentes devolvieron 200 con diferencia distinta cada uno.
    // id es TEXT, no uuid nativo (ver nota en abrir()) — sin cast.
    const [sesion] = await tx.$queryRaw`
      SELECT id, caja_id AS "cajaId", fondo_inicial AS "fondoInicial", cerrada_en AS "cerradaEn"
      FROM sesiones_caja WHERE id = ${sesionId} FOR UPDATE
    `;
    if (!sesion) throw new AppError(404, 'Sesión de caja no encontrada.');
    const caja = await tx.caja.findFirst({ where: { id: sesion.cajaId, empresaId } });
    if (!caja) throw new AppError(404, 'Sesión de caja no encontrada.');
    if (sesion.cerradaEn) throw new AppError(400, 'La sesión ya está cerrada.');

    const movimientos = await tx.movimientoCaja.findMany({ where: { sesionCajaId: sesionId } });
    // Sin redondear, la suma de muchos movimientos en punto flotante de JS arrastra artefactos
    // (mismo problema documentado en shared/redondear.js) que terminaban persistidos tal cual en
    // saldoEsperado/diferencia -- verificado en vivo: "Esperado: 843.4400000000002" mostrado (y
    // guardado) sin redondear al cerrar una sesión real.
    const saldoEsperado = redondear(
      movimientos.reduce((acc, m) => acc + Number(m.monto) * (SIGNO_POR_TIPO[m.tipo] || 0), Number(sesion.fondoInicial)),
    );
    const diferencia = redondear(Number(saldoReal) - saldoEsperado);

    const actualizada = await tx.sesionCaja.update({
      where: { id: sesionId },
      data: { cerradaEn: new Date(), saldoEsperado, saldoReal, diferencia },
    });
    actualizada.__debugMarker = 'CERRAR_V3_' + diferencia;
    actualizada.__debugInfo = {
      localDiferencia: diferencia,
      localDiferenciaType: typeof diferencia,
      returnedDiferencia: actualizada.diferencia,
      returnedDiferenciaType: typeof actualizada.diferencia,
      returnedDiferenciaCtor: actualizada.diferencia?.constructor?.name,
      returnedDiferenciaToString: String(actualizada.diferencia),
    };
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
