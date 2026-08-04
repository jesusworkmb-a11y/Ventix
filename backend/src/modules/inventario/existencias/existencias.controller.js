const AppError = require('../../../shared/errors/AppError');
const service = require('./existencias.service');
const { existenciaInicialSchema } = require('./existencias.validators');

async function listar(req, res) {
  const { sucursalId, articuloId, buscar, soloConStock, pagina, porPagina, ordenarPor, orden } = req.query;
  const existencias = await service.listar({
    empresaId: req.auth.empresaId,
    filtros: { sucursalId, articuloId, buscar, soloConStock: soloConStock === 'true' },
    paginacion: { pagina, porPagina },
    ordenamiento: { ordenarPor, orden },
  });
  res.json(existencias);
}

async function establecerInicial(req, res) {
  const parsed = existenciaInicialSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de existencia inicial inválidos.');
  const resultado = await service.establecerInicial({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    ...parsed.data,
  });
  res.status(201).json(resultado);
}

module.exports = { listar, establecerInicial };
