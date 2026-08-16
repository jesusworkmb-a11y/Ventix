const AppError = require('../../../shared/errors/AppError');
const { enviarDocumentoSchema } = require('../../../shared/validators/enviarDocumento.validator');
const service = require('./ordenes.service');
const { crearOrdenCompraSchema } = require('./ordenes.validators');

async function listar(req, res) {
  const {
    proveedorId, sucursalId, estado, buscar, pagina, porPagina, ordenarPor, orden,
  } = req.query;
  const resultado = await service.listar({
    empresaId: req.auth.empresaId,
    filtros: { proveedorId, sucursalId, estado, buscar },
    paginacion: { pagina, porPagina },
    ordenamiento: { ordenarPor, orden },
  });
  res.json(resultado);
}

async function obtener(req, res) {
  const orden = await service.obtener({ empresaId: req.auth.empresaId, ordenCompraId: req.params.id });
  res.json(orden);
}

async function crear(req, res) {
  const parsed = crearOrdenCompraSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de orden de compra inválidos.');
  const orden = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    ...parsed.data,
  });
  res.status(201).json(orden);
}

async function cancelar(req, res) {
  const orden = await service.cancelar({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    ordenCompraId: req.params.id,
  });
  res.json(orden);
}

async function cerrar(req, res) {
  const orden = await service.cerrar({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    ordenCompraId: req.params.id,
  });
  res.json(orden);
}

async function enviar(req, res) {
  const parsed = enviarDocumentoSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de envío inválidos.');
  const resultado = await service.enviar({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    ordenCompraId: req.params.id,
    ...parsed.data,
  });
  res.json(resultado);
}

module.exports = {
  listar, obtener, crear, cancelar, cerrar, enviar,
};
