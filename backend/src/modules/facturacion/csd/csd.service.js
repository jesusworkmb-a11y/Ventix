const { X509Certificate } = require('crypto');
const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const facturama = require('../../../shared/services/facturama.service');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');

// El certificado/llave privada NUNCA se guardan en la DB de Ventix -- viajan directo al PAC
// (Facturama) para registrarse ahí, y acá solo se persiste la metadata (RFC + vigencia) que
// necesita la UI para mostrar "CSD cargado, vence tal fecha". Ver comentario del modelo
// FacturaCsd en schema.prisma.
async function registrar({
  empresaId, usuarioId, rfc, certificadoBase64, llaveBase64, contrasena,
}) {
  let vigenciaHasta;
  try {
    vigenciaHasta = new X509Certificate(Buffer.from(certificadoBase64, 'base64')).validTo;
  } catch {
    throw new AppError(400, 'El archivo .cer no es un certificado válido.');
  }

  await facturama.registrarCsd({
    rfc, certificadoBase64, llaveBase64, contrasena,
  });

  // A diferencia de Factura crear/cancelar, este registro no dejaba rastro en Auditoría pese a
  // ser un dato legal/fiscal sensible (encontrado en la ronda de QA pre-lanzamiento) -- no se
  // audita el certificado/llave en sí (nunca se persisten, ver comentario de arriba), solo el
  // hecho de que alguien registró/reemplazó el CSD de un RFC y cuándo.
  return prisma.$transaction(async (tx) => {
    const csd = await tx.facturaCsd.upsert({
      where: { empresaId_rfc: { empresaId, rfc } },
      update: { vigenciaHasta: new Date(vigenciaHasta), registradoEn: new Date() },
      create: { empresaId, rfc, vigenciaHasta: new Date(vigenciaHasta) },
    });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId: usuarioId,
      accion: 'CREAR',
      entidad: 'FacturaCsd',
      entidadId: csd.id,
      valoresDespues: toJson({ rfc, vigenciaHasta: csd.vigenciaHasta }),
    });
    return csd;
  });
}

async function listar({ empresaId }) {
  return prisma.facturaCsd.findMany({ where: { empresaId }, orderBy: { rfc: 'asc' } });
}

module.exports = { registrar, listar };
