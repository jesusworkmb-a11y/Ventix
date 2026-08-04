const service = require('./auditoria.service');

async function listar(req, res) {
  const {
    entidad, entidadId, usuarioEjecutorId, desde, hasta, buscar,
    pagina, porPagina, ordenarPor, orden,
  } = req.query;
  const resultado = await service.listar({
    empresaId: req.auth.empresaId,
    filtros: { entidad, entidadId, usuarioEjecutorId, desde, hasta, buscar },
    paginacion: { pagina, porPagina },
    ordenamiento: { ordenarPor, orden },
  });
  res.json(resultado);
}

module.exports = { listar };
