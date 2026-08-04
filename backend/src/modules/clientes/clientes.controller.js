const AppError = require('../../shared/errors/AppError');
const service = require('./clientes.service');
const { crearClienteSchema, actualizarClienteSchema } = require('./clientes.validators');

async function listar(req, res) {
  const { activo, buscar, pagina, porPagina, ordenarPor, orden } = req.query;
  const clientes = await service.listar({
    empresaId: req.auth.empresaId,
    filtros: { activo: activo === undefined ? undefined : activo === 'true', buscar },
    paginacion: { pagina, porPagina },
    ordenamiento: { ordenarPor, orden },
  });
  res.json(clientes);
}

async function obtener(req, res) {
  const cliente = await service.obtener({ empresaId: req.auth.empresaId, clienteId: req.params.id });
  res.json(cliente);
}

async function crear(req, res) {
  const parsed = crearClienteSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de cliente inválidos.');
  const cliente = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    datos: parsed.data,
  });
  res.status(201).json(cliente);
}

async function actualizar(req, res) {
  const parsed = actualizarClienteSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de cliente inválidos.');
  const cliente = await service.actualizar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    clienteId: req.params.id,
    datos: parsed.data,
  });
  res.json(cliente);
}

module.exports = { listar, obtener, crear, actualizar };
