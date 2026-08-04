const AppError = require('../../../shared/errors/AppError');
const service = require('./ajustes.service');
const { crearAjusteSchema } = require('./ajustes.validators');

async function listar(req, res) {
  const { buscar, pagina, porPagina, ordenarPor, orden } = req.query;
  const ajustes = await service.listar({
    empresaId: req.auth.empresaId,
    filtros: { buscar },
    paginacion: { pagina, porPagina },
    ordenamiento: { ordenarPor, orden },
  });
  res.json(ajustes);
}

async function obtener(req, res) {
  const ajuste = await service.obtener({ empresaId: req.auth.empresaId, ajusteId: req.params.id });
  res.json(ajuste);
}

async function crear(req, res) {
  const parsed = crearAjusteSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de ajuste inválidos.');
  const ajuste = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    ...parsed.data,
  });
  res.status(201).json(ajuste);
}

module.exports = { listar, obtener, crear };
