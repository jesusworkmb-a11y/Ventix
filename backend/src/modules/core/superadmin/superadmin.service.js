const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');

async function listarEmpresas() {
  return prisma.empresa.findMany({
    select: {
      id: true,
      nombreComercial: true,
      razonSocial: true,
      correo: true,
      estado: true,
      creadoEn: true,
      _count: { select: { usuariosEmpresa: true, sucursales: true } },
    },
    orderBy: { creadoEn: 'desc' },
  });
}

async function cambiarEstado({ id, estado, usuarioEjecutorId }) {
  const empresa = await prisma.empresa.findUnique({ where: { id } });
  if (!empresa) throw new AppError(404, 'Empresa no encontrada.');

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.empresa.update({ where: { id }, data: { estado } });
    await registrarAuditoria(tx, {
      empresaId: id,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Empresa',
      entidadId: id,
      motivo: 'Cambio de estado por el superadmin de la plataforma.',
      valoresAntes: { estado: empresa.estado },
      valoresDespues: { estado: actualizada.estado },
    });
    return actualizada;
  });
}

module.exports = { listarEmpresas, cambiarEstado };
