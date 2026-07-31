const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');

async function listar({ empresaId }) {
  return prisma.categoria.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } });
}

// Máximo 2 niveles (§10.6): el padre no puede tener a su vez un padre, y no autorreferenciarse.
async function validarPadre({ empresaId, categoriaId, categoriaPadreId }) {
  if (!categoriaPadreId) return;
  if (categoriaPadreId === categoriaId) {
    throw new AppError(400, 'Una categoría no puede ser su propia categoría padre.');
  }
  const padre = await prisma.categoria.findFirst({ where: { id: categoriaPadreId, empresaId } });
  if (!padre) throw new AppError(400, 'La categoría padre indicada no existe.');
  if (padre.categoriaPadreId) {
    throw new AppError(400, 'Solo se permiten 2 niveles de categorías: la categoría padre ya es una subcategoría.');
  }
}

async function crear({ empresaId, usuarioEjecutorId, datos }) {
  await validarPadre({ empresaId, categoriaId: null, categoriaPadreId: datos.categoriaPadreId });

  return prisma.$transaction(async (tx) => {
    const categoria = await tx.categoria.create({ data: { empresaId, ...datos } });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'CREAR',
      entidad: 'Categoria',
      entidadId: categoria.id,
      valoresDespues: toJson(categoria),
    });
    return categoria;
  });
}

async function actualizar({ empresaId, usuarioEjecutorId, categoriaId, datos }) {
  const categoria = await prisma.categoria.findFirst({ where: { id: categoriaId, empresaId } });
  if (!categoria) throw new AppError(404, 'Categoría no encontrada.');

  if (datos.categoriaPadreId) {
    await validarPadre({ empresaId, categoriaId, categoriaPadreId: datos.categoriaPadreId });

    // Si esta categoría ya tiene subcategorías, convertirla en subcategoría de otra excedería 2 niveles.
    const tieneHijas = await prisma.categoria.findFirst({ where: { categoriaPadreId: categoriaId, empresaId } });
    if (tieneHijas) {
      throw new AppError(400, 'Esta categoría ya tiene subcategorías; no puede convertirse en subcategoría de otra.');
    }
  }

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.categoria.update({ where: { id: categoriaId }, data: datos });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Categoria',
      entidadId: categoriaId,
      valoresAntes: toJson(categoria),
      valoresDespues: toJson(actualizada),
    });
    return actualizada;
  });
}

module.exports = { listar, crear, actualizar };
