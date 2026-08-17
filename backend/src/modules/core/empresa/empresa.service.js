const { Prisma } = require('@prisma/client');
const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');

async function actualizar({ empresaId, usuarioEjecutorId, datos }) {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.empresa.update({ where: { id: empresaId }, data: datos });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Empresa',
      entidadId: empresaId,
      valoresAntes: toJson({
        nombreComercial: empresa.nombreComercial,
        logoUrl: empresa.logoUrl,
        colorPrimario: empresa.colorPrimario,
        colorSecundario: empresa.colorSecundario,
        colorAcento: empresa.colorAcento,
        plantillaPdf: empresa.plantillaPdf,
        datosBancarios: empresa.datosBancarios,
        terminosCondicionesPdf: empresa.terminosCondicionesPdf,
      }),
      valoresDespues: toJson({
        nombreComercial: actualizada.nombreComercial,
        logoUrl: actualizada.logoUrl,
        colorPrimario: actualizada.colorPrimario,
        colorSecundario: actualizada.colorSecundario,
        colorAcento: actualizada.colorAcento,
        plantillaPdf: actualizada.plantillaPdf,
        datosBancarios: actualizada.datosBancarios,
        terminosCondicionesPdf: actualizada.terminosCondicionesPdf,
      }),
    });
    return actualizada;
  });
}

async function actualizarFiscal({ empresaId, usuarioEjecutorId, datos }) {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });

  try {
    return await prisma.$transaction(async (tx) => {
      const actualizada = await tx.empresa.update({ where: { id: empresaId }, data: datos });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'ACTUALIZAR',
        entidad: 'Empresa',
        entidadId: empresaId,
        valoresAntes: toJson({
          rfc: empresa.rfc,
          razonSocial: empresa.razonSocial,
          regimenFiscalClave: empresa.regimenFiscalClave,
          slugPublico: empresa.slugPublico,
        }),
        valoresDespues: toJson({
          rfc: actualizada.rfc,
          razonSocial: actualizada.razonSocial,
          regimenFiscalClave: actualizada.regimenFiscalClave,
          slugPublico: actualizada.slugPublico,
        }),
      });
      return actualizada;
    });
  } catch (error) {
    // Mismo saneo de condición de carrera que el resto del proyecto (correo en Core, clave en
    // Sucursal, SKU en Articulo): el slug es único entre empresas, y el check solo lo puede
    // garantizar la DB de forma atómica.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      error.meta?.target?.includes('slug_publico')
    ) {
      throw new AppError(409, 'Ese slug de portal ya está en uso por otra empresa.');
    }
    throw error;
  }
}

module.exports = { actualizar, actualizarFiscal };
