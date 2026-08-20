const { Prisma } = require('@prisma/client');
const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');

// Mismo fix que descuentos.service.js#validarReferencias, mismo motivo (ronda de QA
// pre-lanzamiento): categoriaId/articuloId no se validaban contra la empresa del caller.
async function validarReferencias({ empresaId, categoriaId, articuloId }) {
  if (categoriaId) {
    const categoria = await prisma.categoria.findFirst({ where: { id: categoriaId, empresaId } });
    if (!categoria) throw new AppError(400, 'La categoría indicada no pertenece a esta empresa.');
  }
  if (articuloId) {
    const articulo = await prisma.articulo.findFirst({ where: { id: articuloId, empresaId } });
    if (!articulo) throw new AppError(400, 'El artículo indicado no pertenece a esta empresa.');
  }
}

async function listar({ empresaId }) {
  return prisma.promocion.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } });
}

async function crear({ empresaId, usuarioEjecutorId, datos }) {
  await validarReferencias({ empresaId, categoriaId: datos.categoriaId, articuloId: datos.articuloId });
  return prisma.$transaction(async (tx) => {
    const promocion = await tx.promocion.create({ data: { empresaId, ...datos } });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'CREAR',
      entidad: 'Promocion',
      entidadId: promocion.id,
      valoresDespues: toJson(promocion),
    });
    return promocion;
  });
}

async function actualizar({ empresaId, usuarioEjecutorId, promocionId, datos }) {
  const promocion = await prisma.promocion.findFirst({ where: { id: promocionId, empresaId } });
  if (!promocion) throw new AppError(404, 'Promoción no encontrada.');

  await validarReferencias({ empresaId, categoriaId: datos.categoriaId, articuloId: datos.articuloId });

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.promocion.update({ where: { id: promocionId }, data: datos });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Promocion',
      entidadId: promocionId,
      valoresAntes: toJson(promocion),
      valoresDespues: toJson(actualizada),
    });
    return actualizada;
  });
}

async function eliminar({ empresaId, usuarioEjecutorId, promocionId }) {
  const promocion = await prisma.promocion.findFirst({ where: { id: promocionId, empresaId } });
  if (!promocion) throw new AppError(404, 'Promoción no encontrada.');

  const usos = await prisma.ventaDetalle.count({ where: { promocionId } });
  if (usos > 0) {
    throw new AppError(409, 'No se puede eliminar: ya se aplicó en ventas. Desactívala en su lugar.');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.promocion.delete({ where: { id: promocionId } });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'ELIMINAR',
        entidad: 'Promocion',
        entidadId: promocionId,
        valoresAntes: toJson(promocion),
      });
    });
  } catch (error) {
    // Mismo saneo que descuentos.service: el check de `usos` no es atómico con el delete.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new AppError(409, 'No se puede eliminar: ya se aplicó en ventas. Desactívala en su lugar.');
    }
    throw error;
  }
}

module.exports = { listar, crear, actualizar, eliminar };
