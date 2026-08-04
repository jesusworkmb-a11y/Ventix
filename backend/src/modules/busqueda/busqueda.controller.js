const service = require('./busqueda.service');

async function buscar(req, res) {
  const resultado = await service.buscarGlobal({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    rolId: req.auth.rolId,
    q: req.query.q,
  });
  res.json(resultado);
}

module.exports = { buscar };
