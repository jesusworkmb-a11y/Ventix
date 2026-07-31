const service = require('./auditoria.service');

async function listar(req, res) {
  const { entidad, entidadId, usuarioEjecutorId, desde, hasta } = req.query;
  const registros = await service.listar({
    empresaId: req.auth.empresaId,
    filtros: { entidad, entidadId, usuarioEjecutorId, desde, hasta },
  });
  res.json(registros);
}

module.exports = { listar };
