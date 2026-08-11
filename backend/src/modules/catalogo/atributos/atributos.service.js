const { Prisma } = require('@prisma/client');
const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');

function relanzarConflictoNombre(error, mensaje) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError(409, mensaje);
  }
  throw error;
}

async function listar({ empresaId }) {
  return prisma.atributo.findMany({
    where: { empresaId },
    include: { valores: { orderBy: { valor: 'asc' } } },
    orderBy: { nombre: 'asc' },
  });
}

async function crear({ empresaId, usuarioEjecutorId, datos }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const atributo = await tx.atributo.create({ data: { empresaId, ...datos } });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'CREAR',
        entidad: 'Atributo',
        entidadId: atributo.id,
        valoresDespues: toJson(atributo),
      });
      return { ...atributo, valores: [] };
    });
  } catch (error) {
    relanzarConflictoNombre(error, 'Ya existe un atributo con ese nombre.');
  }
}

async function actualizar({ empresaId, usuarioEjecutorId, atributoId, datos }) {
  const atributo = await prisma.atributo.findFirst({ where: { id: atributoId, empresaId } });
  if (!atributo) throw new AppError(404, 'Atributo no encontrado.');

  try {
    return await prisma.$transaction(async (tx) => {
      const actualizado = await tx.atributo.update({ where: { id: atributoId }, data: datos });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'ACTUALIZAR',
        entidad: 'Atributo',
        entidadId: atributoId,
        valoresAntes: toJson(atributo),
        valoresDespues: toJson(actualizado),
      });
      return actualizado;
    });
  } catch (error) {
    relanzarConflictoNombre(error, 'Ya existe un atributo con ese nombre.');
  }
}

async function eliminar({ empresaId, usuarioEjecutorId, atributoId }) {
  const atributo = await prisma.atributo.findFirst({
    where: { id: atributoId, empresaId },
    include: { valores: true },
  });
  if (!atributo) throw new AppError(404, 'Atributo no encontrado.');
  if (atributo.valores.length > 0) {
    throw new AppError(400, 'Elimina primero todos los valores de este atributo.');
  }

  return prisma.$transaction(async (tx) => {
    await tx.atributo.delete({ where: { id: atributoId } });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ELIMINAR',
      entidad: 'Atributo',
      entidadId: atributoId,
      valoresAntes: toJson(atributo),
    });
  });
}

async function agregarValor({ empresaId, usuarioEjecutorId, atributoId, datos }) {
  const atributo = await prisma.atributo.findFirst({ where: { id: atributoId, empresaId } });
  if (!atributo) throw new AppError(404, 'Atributo no encontrado.');

  try {
    return await prisma.$transaction(async (tx) => {
      const valor = await tx.valorAtributo.create({ data: { atributoId, ...datos } });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'CREAR',
        entidad: 'ValorAtributo',
        entidadId: valor.id,
        valoresDespues: toJson(valor),
      });
      return valor;
    });
  } catch (error) {
    relanzarConflictoNombre(error, 'Ese atributo ya tiene un valor con ese nombre.');
  }
}

async function actualizarValor({ empresaId, usuarioEjecutorId, valorId, datos }) {
  const valor = await prisma.valorAtributo.findFirst({
    where: { id: valorId, atributo: { empresaId } },
  });
  if (!valor) throw new AppError(404, 'Valor no encontrado.');

  try {
    return await prisma.$transaction(async (tx) => {
      const actualizado = await tx.valorAtributo.update({ where: { id: valorId }, data: datos });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'ACTUALIZAR',
        entidad: 'ValorAtributo',
        entidadId: valorId,
        valoresAntes: toJson(valor),
        valoresDespues: toJson(actualizado),
      });
      return actualizado;
    });
  } catch (error) {
    relanzarConflictoNombre(error, 'Ese atributo ya tiene un valor con ese nombre.');
  }
}

async function eliminarValor({ empresaId, usuarioEjecutorId, valorId }) {
  const valor = await prisma.valorAtributo.findFirst({
    where: { id: valorId, atributo: { empresaId } },
  });
  if (!valor) throw new AppError(404, 'Valor no encontrado.');

  const usos = await prisma.articuloValorAtributo.count({ where: { valorAtributoId: valorId } });
  if (usos > 0) {
    throw new AppError(409, 'No se puede eliminar: ya identifica una o más variantes existentes.');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.valorAtributo.delete({ where: { id: valorId } });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'ELIMINAR',
        entidad: 'ValorAtributo',
        entidadId: valorId,
        valoresAntes: toJson(valor),
      });
    });
  } catch (error) {
    // Mismo motivo que en descuentos.service.js#eliminar: el check de `usos` de arriba no es
    // atómico con el delete, el constraint de FK de la DB es la última línea de defensa.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new AppError(409, 'No se puede eliminar: ya identifica una o más variantes existentes.');
    }
    throw error;
  }
}

module.exports = { listar, crear, actualizar, eliminar, agregarValor, actualizarValor, eliminarValor };
