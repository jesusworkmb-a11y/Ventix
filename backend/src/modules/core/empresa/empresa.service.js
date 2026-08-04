const prisma = require('../../../config/db');
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
      valoresAntes: toJson({ nombreComercial: empresa.nombreComercial, logoUrl: empresa.logoUrl }),
      valoresDespues: toJson({ nombreComercial: actualizada.nombreComercial, logoUrl: actualizada.logoUrl }),
    });
    return actualizada;
  });
}

module.exports = { actualizar };
