const { X509Certificate } = require('crypto');
const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const facturama = require('../../../shared/services/facturama.service');

// El certificado/llave privada NUNCA se guardan en la DB de Ventix -- viajan directo al PAC
// (Facturama) para registrarse ahí, y acá solo se persiste la metadata (RFC + vigencia) que
// necesita la UI para mostrar "CSD cargado, vence tal fecha". Ver comentario del modelo
// FacturaCsd en schema.prisma.
async function registrar({
  empresaId, rfc, certificadoBase64, llaveBase64, contrasena,
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

  return prisma.facturaCsd.upsert({
    where: { empresaId_rfc: { empresaId, rfc } },
    update: { vigenciaHasta: new Date(vigenciaHasta), registradoEn: new Date() },
    create: { empresaId, rfc, vigenciaHasta: new Date(vigenciaHasta) },
  });
}

async function listar({ empresaId }) {
  return prisma.facturaCsd.findMany({ where: { empresaId }, orderBy: { rfc: 'asc' } });
}

module.exports = { registrar, listar };
