const AppError = require('../../shared/errors/AppError');
const service = require('./proveedores.service');
const { crearProveedorSchema, actualizarProveedorSchema } = require('./proveedores.validators');

async function listar(req, res) {
  const { activo, buscar, pagina, porPagina, ordenarPor, orden } = req.query;
  const proveedores = await service.listar({
    empresaId: req.auth.empresaId,
    filtros: { activo: activo === undefined ? undefined : activo === 'true', buscar },
    paginacion: { pagina, porPagina },
    ordenamiento: { ordenarPor, orden },
  });
  res.json(proveedores);
}

async function obtener(req, res) {
  const proveedor = await service.obtener({ empresaId: req.auth.empresaId, proveedorId: req.params.id });
  res.json(proveedor);
}

async function crear(req, res) {
  const parsed = crearProveedorSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de proveedor inválidos.');
  const proveedor = await service.crear({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    datos: parsed.data,
  });
  res.status(201).json(proveedor);
}

async function actualizar(req, res) {
  const parsed = actualizarProveedorSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Datos de proveedor inválidos.');
  const proveedor = await service.actualizar({
    empresaId: req.auth.empresaId,
    usuarioEjecutorId: req.auth.usuarioId,
    proveedorId: req.params.id,
    datos: parsed.data,
  });
  res.json(proveedor);
}

module.exports = { listar, obtener, crear, actualizar };
