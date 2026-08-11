const { Prisma } = require('@prisma/client');
const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const { buildSecuenciasPorSucursal } = require('../../../shared/services/secuencia.service');
const toJson = require('../../../shared/toJson');

async function listar({ empresaId }) {
  return prisma.sucursal.findMany({ where: { empresaId }, orderBy: { creadoEn: 'asc' } });
}

async function crear({ empresaId, usuarioEjecutorId, datos }) {
  const existente = await prisma.sucursal.findUnique({
    where: { empresaId_clave: { empresaId, clave: datos.clave } },
  });
  if (existente) throw new AppError(409, 'Ya existe una sucursal con esa clave.');

  try {
    return await prisma.$transaction(async (tx) => {
      const sucursal = await tx.sucursal.create({ data: { empresaId, ...datos } });
      await tx.secuencia.createMany({ data: buildSecuenciasPorSucursal(empresaId, sucursal) });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'CREAR',
        entidad: 'Sucursal',
        entidadId: sucursal.id,
        valoresDespues: toJson(sucursal),
      });
      return sucursal;
    });
  } catch (error) {
    // Mismo saneo de condición de carrera que roles.service/auth.service/usuarios.service: el
    // check previo no es atómico, así que el constraint único de la DB es la última línea de
    // defensa contra dos altas simultáneas con la misma clave.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      error.meta?.target?.includes('clave')
    ) {
      throw new AppError(409, 'Ya existe una sucursal con esa clave.');
    }
    throw error;
  }
}

async function actualizar({ empresaId, usuarioEjecutorId, sucursalId, datos }) {
  const sucursal = await prisma.sucursal.findFirst({ where: { id: sucursalId, empresaId } });
  if (!sucursal) throw new AppError(404, 'Sucursal no encontrada.');

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.sucursal.update({ where: { id: sucursalId }, data: datos });
    // Autorreparación: sucursales creadas antes del fix de secuencias (2026-08-03) se quedaron
    // sin sus filas VTA/COM/COT/DEV/AJU — skipDuplicates hace este createMany un no-op inofensivo
    // para las sucursales que ya las tienen, y las siembra para las que no.
    await tx.secuencia.createMany({
      data: buildSecuenciasPorSucursal(empresaId, actualizada),
      skipDuplicates: true,
    });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Sucursal',
      entidadId: sucursal.id,
      valoresAntes: toJson(sucursal),
      valoresDespues: toJson(actualizada),
    });
    return actualizada;
  });
}

module.exports = { listar, crear, actualizar };
