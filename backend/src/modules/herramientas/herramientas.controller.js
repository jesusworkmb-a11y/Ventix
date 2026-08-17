const AppError = require('../../shared/errors/AppError');
const service = require('./herramientas.service');
const {
  importarArticulosSchema,
  importarClientesSchema,
  importarProveedoresSchema,
} = require('./herramientas.validators');

function enviarCsv(res, nombreArchivo, contenido) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
  res.send(contenido);
}

async function exportarArticulos(req, res) {
  const csv = await service.exportarArticulos({ empresaId: req.auth.empresaId });
  enviarCsv(res, 'articulos.csv', csv);
}

async function exportarClientes(req, res) {
  const csv = await service.exportarClientes({ empresaId: req.auth.empresaId });
  enviarCsv(res, 'clientes.csv', csv);
}

async function exportarProveedores(req, res) {
  const csv = await service.exportarProveedores({ empresaId: req.auth.empresaId });
  enviarCsv(res, 'proveedores.csv', csv);
}

async function importarArticulos(req, res) {
  const parsed = importarArticulosSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Falta el contenido CSV a importar.');
  const resultado = await service.importarArticulos({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    csv: parsed.data.csv,
  });
  res.json(resultado);
}

async function importarClientes(req, res) {
  const parsed = importarClientesSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Falta el contenido CSV a importar.');
  const resultado = await service.importarClientes({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    csv: parsed.data.csv,
  });
  res.json(resultado);
}

async function importarProveedores(req, res) {
  const parsed = importarProveedoresSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Falta el contenido CSV a importar.');
  const resultado = await service.importarProveedores({
    empresaId: req.auth.empresaId,
    usuarioId: req.auth.usuarioId,
    csv: parsed.data.csv,
  });
  res.json(resultado);
}

module.exports = {
  exportarArticulos,
  exportarClientes,
  exportarProveedores,
  importarArticulos,
  importarClientes,
  importarProveedores,
};
