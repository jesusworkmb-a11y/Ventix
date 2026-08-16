const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { obtenerSiguienteFolio } = require('../../../shared/services/secuencia.service');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const { enviarCorreoConAdjunto } = require('../../../shared/services/correo.service');
const toJson = require('../../../shared/toJson');
const { parsePaginacion, parseOrden, respuestaPaginada } = require('../../../shared/paginacion');
// Mismo módulo top-level "compras" (submódulo, no cruza §3.1) — reusa el cálculo de factor
// unidad→base ya probado en compras.service.js, en vez de duplicarlo.
const comprasService = require('../compras.service');

const COLUMNAS_ORDENABLES = {
  folio: 'folio',
  proveedor: 'proveedor.nombre',
  estado: 'estado',
  creadoEn: 'creadoEn',
};

async function listar({ empresaId, filtros, paginacion, ordenamiento }) {
  const where = { empresaId };
  if (filtros.proveedorId) where.proveedorId = filtros.proveedorId;
  if (filtros.sucursalId) where.sucursalId = filtros.sucursalId;
  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.buscar) {
    where.OR = [
      { folio: { contains: filtros.buscar, mode: 'insensitive' } },
      { proveedor: { nombre: { contains: filtros.buscar, mode: 'insensitive' } } },
    ];
  }

  const paginado = parsePaginacion(paginacion);
  const orderBy = parseOrden(ordenamiento || {}, COLUMNAS_ORDENABLES, { creadoEn: 'desc' });

  const [datos, total] = await Promise.all([
    prisma.ordenCompra.findMany({
      where,
      include: { proveedor: true, sucursal: true },
      orderBy,
      skip: paginado.skip,
      take: paginado.take,
    }),
    prisma.ordenCompra.count({ where }),
  ]);

  return respuestaPaginada(datos, total, paginado);
}

async function obtener({ empresaId, ordenCompraId }) {
  const orden = await prisma.ordenCompra.findFirst({
    where: { id: ordenCompraId, empresaId },
    include: {
      detalles: true,
      proveedor: true,
      sucursal: true,
      compras: { select: { id: true, folio: true, estado: true, total: true, creadoEn: true }, orderBy: { creadoEn: 'asc' } },
    },
  });
  if (!orden) throw new AppError(404, 'Orden de compra no encontrada.');

  const articuloIds = [...new Set(orden.detalles.map((d) => d.articuloId))];
  const unidadIds = [...new Set(orden.detalles.map((d) => d.unidadId))];
  const [articulos, unidades] = await Promise.all([
    prisma.articulo.findMany({ where: { id: { in: articuloIds } }, select: { id: true, nombre: true, sku: true } }),
    prisma.unidad.findMany({
      where: { id: { in: unidadIds } },
      select: { id: true, nombre: true, abreviatura: true },
    }),
  ]);
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));
  const unidadPorId = new Map(unidades.map((u) => [u.id, u]));

  return {
    ...orden,
    detalles: orden.detalles.map((d) => ({
      ...d,
      articulo: articuloPorId.get(d.articuloId) || null,
      unidad: unidadPorId.get(d.unidadId) || null,
    })),
  };
}

async function crear({
  empresaId, usuarioId, sucursalId, proveedorId, observaciones, detalles,
}) {
  const sucursal = await prisma.sucursal.findFirst({ where: { id: sucursalId, empresaId } });
  if (!sucursal) throw new AppError(400, 'La sucursal indicada no pertenece a esta empresa.');

  const proveedor = await prisma.proveedor.findFirst({ where: { id: proveedorId, empresaId } });
  if (!proveedor) throw new AppError(400, 'El proveedor indicado no pertenece a esta empresa.');
  if (!proveedor.activo) {
    throw new AppError(400, 'El proveedor está inactivo y no se le pueden crear órdenes de compra.');
  }

  const articuloIds = detalles.map((d) => d.articuloId);
  const articulos = await prisma.articulo.findMany({ where: { id: { in: articuloIds }, empresaId } });
  if (articulos.length !== new Set(articuloIds).size) {
    throw new AppError(400, 'Algún artículo indicado no pertenece a esta empresa o está repetido.');
  }
  // Mismo criterio que compras.service.js#crear: un Kit no se recibe de un proveedor como
  // unidad — lo que se pide/recibe son sus componentes por separado.
  if (articulos.some((a) => a.tipo === 'KIT')) {
    throw new AppError(400, 'Un artículo tipo Kit no se puede solicitar directamente — pedí sus componentes por separado.');
  }
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  const lineas = [];
  for (const detalle of detalles) {
    const articulo = articuloPorId.get(detalle.articuloId);
    // Mismo cálculo que compras.service.js#crear — congela la cantidad solicitada en unidad
    // base para poder comparar contra lo recibido sin importar en qué unidad llegue cada
    // recepción (ver OrdenCompraDetalle.cantidadBase en el schema).
    const factor = await comprasService.resolverFactor({ articulo, unidadId: detalle.unidadId });
    lineas.push({ ...detalle, cantidadBase: detalle.cantidad * factor });
  }

  return prisma.$transaction(async (tx) => {
    const folio = await obtenerSiguienteFolio(tx, { empresaId, sucursalId, tipoDocumento: 'OC' });

    const orden = await tx.ordenCompra.create({
      data: {
        empresaId, sucursalId, proveedorId, usuarioId, folio, observaciones,
      },
    });

    await tx.ordenCompraDetalle.createMany({
      data: lineas.map((l) => ({
        ordenCompraId: orden.id,
        articuloId: l.articuloId,
        unidadId: l.unidadId,
        cantidad: l.cantidad,
        cantidadBase: l.cantidadBase,
        costoEstimado: l.costoEstimado,
      })),
    });

    await registrarAuditoria(tx, {
      empresaId,
      sucursalId,
      usuarioEjecutorId: usuarioId,
      accion: 'CREAR',
      entidad: 'OrdenCompra',
      entidadId: orden.id,
      folio,
      valoresDespues: toJson({ proveedorId, observaciones, detalles: lineas }),
    });

    return { ...orden, detalles: lineas };
  });
}

// Solo puede cancelarse una orden sin ninguna recepción todavía — una vez que llegó algo, ese
// stock/gasto ya es real (quedó en una Compra vinculada), así que la salida es "Cerrar" (corta lo
// pendiente), no "Cancelar" (implicaría que nunca pasó nada). Mismo patrón de candado atómico
// (UPDATE...WHERE estado=X) que el resto del proyecto para evitar la carrera de dos acciones
// simultáneas sobre el mismo documento.
async function cancelar({ empresaId, usuarioId, ordenCompraId }) {
  const orden = await prisma.ordenCompra.findFirst({ where: { id: ordenCompraId, empresaId } });
  if (!orden) throw new AppError(404, 'Orden de compra no encontrada.');

  const reclamada = await prisma.ordenCompra.updateMany({
    where: { id: ordenCompraId, estado: 'ENVIADA' },
    data: { estado: 'CANCELADA' },
  });
  if (reclamada.count === 0) {
    throw new AppError(
      400,
      'Solo se pueden cancelar órdenes sin ninguna recepción. Si ya se recibió algo, usa "Cerrar".',
    );
  }

  await registrarAuditoria(null, {
    empresaId,
    sucursalId: orden.sucursalId,
    usuarioEjecutorId: usuarioId,
    accion: 'ACTUALIZAR',
    entidad: 'OrdenCompra',
    entidadId: ordenCompraId,
    valoresAntes: toJson({ estado: 'ENVIADA' }),
    valoresDespues: toJson({ estado: 'CANCELADA' }),
  });

  return prisma.ordenCompra.findUnique({ where: { id: ordenCompraId } });
}

// Corta lo pendiente de una orden que ya tuvo alguna recepción (o ninguna) pero no va a
// completarse — el proveedor no va a mandar el resto. No revierte ni toca las Compra ya
// vinculadas, solo cambia el estado de la orden para sacarla de la lista de "pendientes de
// recibir".
async function cerrar({ empresaId, usuarioId, ordenCompraId }) {
  const orden = await prisma.ordenCompra.findFirst({ where: { id: ordenCompraId, empresaId } });
  if (!orden) throw new AppError(404, 'Orden de compra no encontrada.');

  const reclamada = await prisma.ordenCompra.updateMany({
    where: { id: ordenCompraId, estado: { in: ['ENVIADA', 'PARCIAL'] } },
    data: { estado: 'CERRADA' },
  });
  if (reclamada.count === 0) {
    throw new AppError(400, 'Solo se pueden cerrar órdenes enviadas o con recepción parcial.');
  }

  await registrarAuditoria(null, {
    empresaId,
    sucursalId: orden.sucursalId,
    usuarioEjecutorId: usuarioId,
    accion: 'ACTUALIZAR',
    entidad: 'OrdenCompra',
    entidadId: ordenCompraId,
    valoresAntes: toJson({ estado: orden.estado }),
    valoresDespues: toJson({ estado: 'CERRADA' }),
  });

  return prisma.ordenCompra.findUnique({ where: { id: ordenCompraId } });
}

// Mismo criterio que compras.service.js#enviar: el PDF ya viene armado desde el frontend en
// base64, acá solo se resuelve el folio/empresa para el asunto por defecto y se audita.
async function enviar({
  empresaId, usuarioId, ordenCompraId, destinatario, asunto, mensaje, adjuntoBase64, nombreArchivo,
}) {
  const orden = await prisma.ordenCompra.findFirst({ where: { id: ordenCompraId, empresaId } });
  if (!orden) throw new AppError(404, 'Orden de compra no encontrada.');

  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
  const asuntoFinal = asunto || `Orden de compra ${orden.folio} — ${empresa?.nombreComercial || 'BOX POS'}`;

  await enviarCorreoConAdjunto({
    destinatario,
    asunto: asuntoFinal,
    mensaje,
    adjunto: { nombreArchivo, contenidoBase64: adjuntoBase64 },
  });

  await registrarAuditoria(null, {
    empresaId,
    sucursalId: orden.sucursalId,
    usuarioEjecutorId: usuarioId,
    accion: 'ENVIAR_CORREO',
    entidad: 'OrdenCompra',
    entidadId: orden.id,
    folio: orden.folio,
    valoresDespues: toJson({ destinatario }),
  });

  return { enviado: true };
}

module.exports = {
  listar, obtener, crear, cancelar, cerrar, enviar,
};
