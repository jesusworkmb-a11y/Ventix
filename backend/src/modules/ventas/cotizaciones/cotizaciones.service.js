const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { obtenerSiguienteFolio } = require('../../../shared/services/secuencia.service');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');
const redondear = require('../../../shared/redondear');
// Reusa ventas.service.js#crear en vez de duplicar la transacción de venta — es un sub-recurso
// del mismo módulo (MOD-008), no un import entre módulos distintos (§3.1 solo prohíbe eso).
const ventasService = require('../ventas/ventas.service');

async function listar({ empresaId }) {
  return prisma.cotizacion.findMany({ where: { empresaId }, orderBy: { creadoEn: 'desc' }, take: 200 });
}

async function obtener({ empresaId, cotizacionId }) {
  const cotizacion = await prisma.cotizacion.findFirst({
    where: { id: cotizacionId, empresaId },
    include: { detalles: true },
  });
  if (!cotizacion) throw new AppError(404, 'Cotización no encontrada.');

  const articuloIds = [...new Set(cotizacion.detalles.map((d) => d.articuloId))];
  const articulos = await prisma.articulo.findMany({
    where: { id: { in: articuloIds } },
    select: { id: true, nombre: true, sku: true },
  });
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  return {
    ...cotizacion,
    detalles: cotizacion.detalles.map((d) => ({ ...d, articulo: articuloPorId.get(d.articuloId) || null })),
  };
}

// Sin movimiento de stock ni de caja — es un borrador. El precio de línea no exige permisos
// especiales aquí (no es dinero real todavía); si se manda uno distinto al de catálogo, el
// chequeo de venta.modificar_precio/aplicar_descuento se aplica al convertir (ver abajo),
// que es el momento en que el precio sí se vuelve una transacción real.
async function crear({ empresaId, usuarioId, sucursalId, clienteId, detalles }) {
  const sucursal = await prisma.sucursal.findFirst({ where: { id: sucursalId, empresaId } });
  if (!sucursal) throw new AppError(400, 'La sucursal indicada no pertenece a esta empresa.');

  const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, empresaId } });
  if (!cliente) throw new AppError(400, 'El cliente indicado no pertenece a esta empresa.');

  const articuloIds = detalles.map((d) => d.articuloId);
  const articulos = await prisma.articulo.findMany({ where: { id: { in: articuloIds }, empresaId } });
  if (articulos.length !== new Set(articuloIds).size) {
    throw new AppError(400, 'Algún artículo indicado no pertenece a esta empresa o está repetido.');
  }
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  const lineas = detalles.map((d) => ({
    articuloId: d.articuloId,
    cantidad: d.cantidad,
    precio: d.precio !== undefined ? d.precio : Number(articuloPorId.get(d.articuloId).precio),
  }));
  const total = redondear(lineas.reduce((acc, l) => acc + l.cantidad * l.precio, 0));

  return prisma.$transaction(async (tx) => {
    const folio = await obtenerSiguienteFolio(tx, { empresaId, sucursalId, tipoDocumento: 'COT' });

    const cotizacion = await tx.cotizacion.create({
      data: { empresaId, sucursalId, clienteId, usuarioId, folio, total },
    });

    await tx.cotizacionDetalle.createMany({
      data: lineas.map((l) => ({
        cotizacionId: cotizacion.id,
        articuloId: l.articuloId,
        cantidad: l.cantidad,
        precio: l.precio,
      })),
    });

    await registrarAuditoria(tx, {
      empresaId,
      sucursalId,
      usuarioEjecutorId: usuarioId,
      accion: 'CREAR',
      entidad: 'Cotizacion',
      entidadId: cotizacion.id,
      folio,
      valoresDespues: toJson({ clienteId, total, detalles: lineas }),
    });

    return { ...cotizacion, detalles: lineas };
  });
}

// La venta y el marcado de convertidaEnVentaId no comparten transacción: en el caso raro de
// que la venta se cree pero este segundo paso falle, la cotización queda sin marcar pero la
// venta sigue siendo válida — no hay pérdida de datos financieros, solo de la referencia cruzada.
async function convertir({ empresaId, usuarioId, rolId, cotizacionId, sesionCajaId, pagos }) {
  const cotizacion = await prisma.cotizacion.findFirst({
    where: { id: cotizacionId, empresaId },
    include: { detalles: true },
  });
  if (!cotizacion) throw new AppError(404, 'Cotización no encontrada.');
  if (cotizacion.convertidaEnVentaId) throw new AppError(400, 'Esta cotización ya fue convertida en venta.');

  const venta = await ventasService.crear({
    empresaId,
    usuarioId,
    rolId,
    sucursalId: cotizacion.sucursalId,
    clienteId: cotizacion.clienteId,
    sesionCajaId,
    detalles: cotizacion.detalles.map((d) => ({
      articuloId: d.articuloId,
      cantidad: Number(d.cantidad),
      precio: Number(d.precio),
    })),
    pagos,
  });

  await prisma.cotizacion.update({ where: { id: cotizacionId }, data: { convertidaEnVentaId: venta.id } });

  return venta;
}

module.exports = { listar, obtener, crear, convertir };
