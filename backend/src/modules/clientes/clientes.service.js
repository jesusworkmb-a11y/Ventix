const prisma = require('../../config/db');
const AppError = require('../../shared/errors/AppError');
const { registrarAuditoria } = require('../../shared/services/auditoria.service');
const toJson = require('../../shared/toJson');

// Garantiza que la empresa tenga su Cliente General (§14.1, mostrador/venta sin cliente
// específico). Resuelto de forma perezosa aquí (no en el registro de empresa de Core) para
// que funcione sin importar cuándo se creó la empresa ni cuándo reinició el servidor —
// evita el hueco que tendría un backfill global corrido solo al arrancar.
async function asegurarClienteGeneral(empresaId) {
  const existente = await prisma.cliente.findFirst({ where: { empresaId, esGeneral: true } });
  if (existente) return existente;
  return prisma.cliente.create({ data: { empresaId, esGeneral: true, nombre: 'Cliente General' } });
}

async function validarListaPrecio({ empresaId, listaPrecioId }) {
  if (!listaPrecioId) return;
  const lista = await prisma.listaPrecio.findFirst({ where: { id: listaPrecioId, empresaId } });
  if (!lista) throw new AppError(400, 'La lista de precio indicada no pertenece a esta empresa.');
}

async function listar({ empresaId, filtros }) {
  await asegurarClienteGeneral(empresaId);

  const where = { empresaId };
  if (filtros.activo !== undefined) where.activo = filtros.activo;
  if (filtros.buscar) {
    where.OR = [
      { nombre: { contains: filtros.buscar, mode: 'insensitive' } },
      { correo: { contains: filtros.buscar, mode: 'insensitive' } },
      { telefono: { contains: filtros.buscar, mode: 'insensitive' } },
      { rfc: { contains: filtros.buscar, mode: 'insensitive' } },
    ];
  }
  return prisma.cliente.findMany({ where, orderBy: [{ esGeneral: 'desc' }, { nombre: 'asc' }] });
}

async function obtener({ empresaId, clienteId }) {
  const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, empresaId } });
  if (!cliente) throw new AppError(404, 'Cliente no encontrado.');
  return cliente;
}

async function crear({ empresaId, usuarioEjecutorId, datos }) {
  await validarListaPrecio({ empresaId, listaPrecioId: datos.listaPrecioId });

  return prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.create({ data: { empresaId, ...datos } });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'CREAR',
      entidad: 'Cliente',
      entidadId: cliente.id,
      valoresDespues: toJson(cliente),
    });
    return cliente;
  });
}

async function actualizar({ empresaId, usuarioEjecutorId, clienteId, datos }) {
  const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, empresaId } });
  if (!cliente) throw new AppError(404, 'Cliente no encontrado.');

  if (cliente.esGeneral && datos.activo === false) {
    throw new AppError(400, 'No puedes desactivar el Cliente General.');
  }

  await validarListaPrecio({ empresaId, listaPrecioId: datos.listaPrecioId });

  return prisma.$transaction(async (tx) => {
    const actualizado = await tx.cliente.update({ where: { id: clienteId }, data: datos });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Cliente',
      entidadId: clienteId,
      valoresAntes: toJson(cliente),
      valoresDespues: toJson(actualizado),
    });
    return actualizado;
  });
}

module.exports = { listar, obtener, crear, actualizar };
