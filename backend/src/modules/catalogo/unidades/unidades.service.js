const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');
const { validarNombreUnico, relanzarConflictoNombre } = require('../../../shared/nombreUnico');

const MENSAJE_DUPLICADO = 'Ya existe una unidad con ese nombre.';

async function listar({ empresaId }) {
  return prisma.unidad.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } });
}

async function crear({ empresaId, usuarioEjecutorId, datos }) {
  await validarNombreUnico({
    prisma, modelo: 'unidad', empresaId, id: null, nombre: datos.nombre, mensaje: MENSAJE_DUPLICADO,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const unidad = await tx.unidad.create({ data: { empresaId, ...datos } });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'CREAR',
        entidad: 'Unidad',
        entidadId: unidad.id,
        valoresDespues: toJson(unidad),
      });
      return unidad;
    });
  } catch (error) {
    relanzarConflictoNombre(error, MENSAJE_DUPLICADO);
  }
}

async function actualizar({ empresaId, usuarioEjecutorId, unidadId, datos }) {
  const unidad = await prisma.unidad.findFirst({ where: { id: unidadId, empresaId } });
  if (!unidad) throw new AppError(404, 'Unidad no encontrada.');

  await validarNombreUnico({
    prisma, modelo: 'unidad', empresaId, id: unidadId, nombre: datos.nombre, mensaje: MENSAJE_DUPLICADO,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const actualizada = await tx.unidad.update({ where: { id: unidadId }, data: datos });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'ACTUALIZAR',
        entidad: 'Unidad',
        entidadId: unidadId,
        valoresAntes: toJson(unidad),
        valoresDespues: toJson(actualizada),
      });
      return actualizada;
    });
  } catch (error) {
    relanzarConflictoNombre(error, MENSAJE_DUPLICADO);
  }
}

module.exports = { listar, crear, actualizar };
