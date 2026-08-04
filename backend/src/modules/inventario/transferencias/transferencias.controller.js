const AppError = require('../../../shared/errors/AppError');
const service = require('./transferencias.service');
const { crearTransferenciaSchema } = require('./transferencias.validators');

async function listar(req, res) {
  const { buscar, pagina, porPagina, ordenarPor, orden } = req.query;
  const transferencias = await service.listar({
    empresaId: req.auth.empresaId,
    filtros: { buscar },
    paginacion: { pagina, porPagina },
    ordenamiento: { ordenarPor, orden },
  });
  res.json(transferencias);
}

async function obtener(req, res) {
  const transferencia = await service.obtener({
    empresaId: req.auth.empresaId,
    transferenciaId: req.params.id,
  });
  res.json(transferencia);
}

async function crear(req, res) {
  const parsed = crearTransferenciaSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de transferencia inválidos.');
  const transferencia = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    ...parsed.data,
  });
  res.status(201).json(transferencia);
}

async function recibir(req, res) {
  const transferencia = await service.recibir({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    transferenciaId: req.params.id,
  });
  res.json(transferencia);
}

module.exports = { listar, obtener, crear, recibir };
