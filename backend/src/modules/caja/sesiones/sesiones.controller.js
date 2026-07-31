const AppError = require('../../../shared/errors/AppError');
const { usuarioTienePermiso } = require('../../../shared/services/permisos.service');
const service = require('./sesiones.service');
const { abrirSesionSchema, cerrarSesionSchema, movimientoSchema } = require('./sesiones.validators');

async function listar(req, res) {
  const { cajaId, abierta } = req.query;
  const sesiones = await service.listar({ empresaId: req.auth.empresaId, filtros: { cajaId, abierta } });
  res.json(sesiones);
}

async function obtener(req, res) {
  const sesion = await service.obtener({ empresaId: req.auth.empresaId, sesionId: req.params.id });
  res.json(sesion);
}

async function abrir(req, res) {
  const parsed = abrirSesionSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de apertura inválidos.');
  const sesion = await service.abrir({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    ...parsed.data,
  });
  res.status(201).json(sesion);
}

async function cerrar(req, res) {
  const parsed = cerrarSesionSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de cierre inválidos.');
  const sesion = await service.cerrar({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    sesionId: req.params.id,
    saldoReal: parsed.data.saldoReal,
  });
  res.json(sesion);
}

// Único endpoint del proyecto donde el permiso depende del body, no solo de la ruta: INGRESO
// exige caja.ingreso, RETIRO exige caja.retiro. requierePermiso (middleware de ruta fija) no
// sirve aquí, así que el chequeo se hace a mano con usuarioTienePermiso ya validado el tipo.
async function registrarMovimiento(req, res) {
  const parsed = movimientoSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de movimiento inválidos.');

  const clave = parsed.data.tipo === 'INGRESO' ? 'caja.ingreso' : 'caja.retiro';
  const tienePermiso = await usuarioTienePermiso({
    usuarioId: req.auth.usuarioId,
    rolId: req.auth.rolId,
    clave,
  });
  if (!tienePermiso) throw new AppError(403, 'No tienes permiso para realizar esta acción.');

  const movimiento = await service.registrarMovimiento({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    sesionId: req.params.id,
    ...parsed.data,
  });
  res.status(201).json(movimiento);
}

module.exports = { listar, obtener, abrir, cerrar, registrarMovimiento };
