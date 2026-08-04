const AppError = require('../../shared/errors/AppError');
const service = require('./compras.service');
const { crearCompraSchema } = require('./compras.validators');

async function listar(req, res) {
  const {
    proveedorId, sucursalId, estado, desde, hasta, buscar,
    pagina, porPagina, ordenarPor, orden,
  } = req.query;
  const resultado = await service.listar({
    empresaId: req.auth.empresaId,
    filtros: { proveedorId, sucursalId, estado, desde, hasta, buscar },
    paginacion: { pagina, porPagina },
    ordenamiento: { ordenarPor, orden },
  });
  res.json(resultado);
}

async function obtener(req, res) {
  const compra = await service.obtener({ empresaId: req.auth.empresaId, compraId: req.params.id });
  res.json(compra);
}

async function crear(req, res) {
  const parsed = crearCompraSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de compra inválidos.');
  const compra = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    ...parsed.data,
  });
  res.status(201).json(compra);
}

async function cancelar(req, res) {
  const compra = await service.cancelar({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    compraId: req.params.id,
  });
  res.json(compra);
}

module.exports = { listar, obtener, crear, cancelar };
