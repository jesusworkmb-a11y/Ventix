const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');
const { validarNombreUnico, relanzarConflictoNombre } = require('../../../shared/nombreUnico');

const MENSAJE_DUPLICADO = 'Ya existe un impuesto con ese nombre.';

async function listar({ empresaId }) {
  return prisma.impuesto.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } });
}

async function crear({ empresaId, usuarioEjecutorId, datos }) {
  await validarNombreUnico({
    prisma, modelo: 'impuesto', empresaId, id: null, nombre: datos.nombre, mensaje: MENSAJE_DUPLICADO,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const impuesto = await tx.impuesto.create({ data: { empresaId, ...datos } });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'CREAR',
        entidad: 'Impuesto',
        entidadId: impuesto.id,
        valoresDespues: toJson(impuesto),
      });
      return impuesto;
    });
  } catch (error) {
    relanzarConflictoNombre(error, MENSAJE_DUPLICADO);
  }
}

async function actualizar({ empresaId, usuarioEjecutorId, impuestoId, datos }) {
  const impuesto = await prisma.impuesto.findFirst({ where: { id: impuestoId, empresaId } });
  if (!impuesto) throw new AppError(404, 'Impuesto no encontrado.');

  await validarNombreUnico({
    prisma, modelo: 'impuesto', empresaId, id: impuestoId, nombre: datos.nombre, mensaje: MENSAJE_DUPLICADO,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const actualizado = await tx.impuesto.update({ where: { id: impuestoId }, data: datos });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'ACTUALIZAR',
        entidad: 'Impuesto',
        entidadId: impuestoId,
        valoresAntes: toJson(impuesto),
        valoresDespues: toJson(actualizado),
      });
      return actualizado;
    });
  } catch (error) {
    relanzarConflictoNombre(error, MENSAJE_DUPLICADO);
  }
}

module.exports = { listar, crear, actualizar };
