const prisma = require('../../config/db');
const AppError = require('../../shared/errors/AppError');
const { aplicarMovimiento } = require('../../shared/services/inventario.service');
const { obtenerSiguienteFolio } = require('../../shared/services/secuencia.service');
const { registrarAuditoria } = require('../../shared/services/auditoria.service');
const toJson = require('../../shared/toJson');

async function listar({ empresaId, filtros }) {
  const where = { empresaId };
  if (filtros.proveedorId) where.proveedorId = filtros.proveedorId;
  if (filtros.sucursalId) where.sucursalId = filtros.sucursalId;
  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.desde || filtros.hasta) {
    where.creadoEn = {};
    if (filtros.desde) where.creadoEn.gte = new Date(filtros.desde);
    if (filtros.hasta) where.creadoEn.lte = new Date(filtros.hasta);
  }
  return prisma.compra.findMany({
    where,
    include: { proveedor: true, sucursal: true },
    orderBy: { creadoEn: 'desc' },
    take: 200,
  });
}

async function obtener({ empresaId, compraId }) {
  const compra = await prisma.compra.findFirst({
    where: { id: compraId, empresaId },
    include: { detalles: true },
  });
  if (!compra) throw new AppError(404, 'Compra no encontrada.');

  const articuloIds = [...new Set(compra.detalles.map((d) => d.articuloId))];
  const unidadIds = [...new Set(compra.detalles.map((d) => d.unidadId))];
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
    ...compra,
    detalles: compra.detalles.map((d) => ({
      ...d,
      articulo: articuloPorId.get(d.articuloId) || null,
      unidad: unidadPorId.get(d.unidadId) || null,
    })),
  };
}

// Resuelve el factor de conversión de unidadId hacia la unidad base del artículo: 1 si es la
// propia base, o el factor de su UnidadAlterna (Catálogo, Fase 2) si es una alterna válida.
async function resolverFactor({ articulo, unidadId }) {
  if (unidadId === articulo.unidadBaseId) return 1;
  const alterna = await prisma.unidadAlterna.findUnique({
    where: { articuloId_unidadId: { articuloId: articulo.id, unidadId } },
  });
  if (!alterna) {
    throw new AppError(
      400,
      `La unidad indicada no es la base ni una alterna válida del artículo ${articulo.nombre}.`,
    );
  }
  return Number(alterna.factor);
}

async function crear({ empresaId, usuarioId, sucursalId, proveedorId, detalles }) {
  const sucursal = await prisma.sucursal.findFirst({ where: { id: sucursalId, empresaId } });
  if (!sucursal) throw new AppError(400, 'La sucursal indicada no pertenece a esta empresa.');

  const proveedor = await prisma.proveedor.findFirst({ where: { id: proveedorId, empresaId } });
  if (!proveedor) throw new AppError(400, 'El proveedor indicado no pertenece a esta empresa.');

  const articuloIds = detalles.map((d) => d.articuloId);
  const articulos = await prisma.articulo.findMany({ where: { id: { in: articuloIds }, empresaId } });
  if (articulos.length !== new Set(articuloIds).size) {
    throw new AppError(400, 'Algún artículo indicado no pertenece a esta empresa o está repetido.');
  }
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  const lineas = [];
  for (const detalle of detalles) {
    const articulo = articuloPorId.get(detalle.articuloId);
    const factor = await resolverFactor({ articulo, unidadId: detalle.unidadId });
    lineas.push({ ...detalle, factor, cantidadBase: detalle.cantidad * factor });
  }

  const total = lineas.reduce((acc, l) => acc + l.cantidad * l.costo, 0);

  return prisma.$transaction(async (tx) => {
    const folio = await obtenerSiguienteFolio(tx, { empresaId, sucursalId, tipoDocumento: 'COM' });

    const compra = await tx.compra.create({
      data: { empresaId, sucursalId, proveedorId, usuarioId, folio, total },
    });

    await tx.compraDetalle.createMany({
      data: lineas.map((l) => ({
        compraId: compra.id,
        articuloId: l.articuloId,
        unidadId: l.unidadId,
        cantidad: l.cantidad,
        costo: l.costo,
      })),
    });

    for (const linea of lineas) {
      await aplicarMovimiento(tx, {
        empresaId,
        sucursalId,
        articuloId: linea.articuloId,
        tipo: 'ENTRADA_COMPRA',
        cantidad: linea.cantidadBase,
        referenciaTipo: 'Compra',
        referenciaId: compra.id,
        usuarioId,
      });

      // "Último costo" (§16.3), expresado en unidad base — se actualiza solo al confirmar,
      // no se revierte al cancelar (documentado en el plan de esta fase).
      await tx.articulo.update({
        where: { id: linea.articuloId },
        data: { costo: linea.costo / linea.factor },
      });
    }

    await registrarAuditoria(tx, {
      empresaId,
      sucursalId,
      usuarioEjecutorId: usuarioId,
      accion: 'CREAR',
      entidad: 'Compra',
      entidadId: compra.id,
      folio,
      valoresDespues: toJson({ proveedorId, total, detalles }),
    });

    return { ...compra, detalles: lineas };
  });
}

async function cancelar({ empresaId, usuarioId, compraId }) {
  const compra = await prisma.compra.findFirst({
    where: { id: compraId, empresaId },
    include: { detalles: true },
  });
  if (!compra) throw new AppError(404, 'Compra no encontrada.');
  if (compra.estado !== 'CONFIRMADA') throw new AppError(400, 'Solo se pueden cancelar compras confirmadas.');

  const articuloIds = [...new Set(compra.detalles.map((d) => d.articuloId))];
  const articulos = await prisma.articulo.findMany({ where: { id: { in: articuloIds } } });
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  // Vuelve a resolver el factor de cada línea porque CompraDetalle no guarda la cantidad ya
  // convertida a unidad base. Si el artículo ya no tiene esa unidad alterna (alguien reemplazó
  // el set completo vía Catálogo), no se arriesga un número incorrecto: se rechaza con 409.
  const reversiones = [];
  for (const detalle of compra.detalles) {
    const articulo = articuloPorId.get(detalle.articuloId);
    if (!articulo) {
      throw new AppError(409, 'No se pudo resolver el artículo de una línea; no se puede cancelar automáticamente.');
    }
    const factor = await resolverFactor({ articulo, unidadId: detalle.unidadId });
    reversiones.push({ articuloId: detalle.articuloId, cantidadBase: Number(detalle.cantidad) * factor });
  }

  return prisma.$transaction(async (tx) => {
    for (const reversion of reversiones) {
      await aplicarMovimiento(tx, {
        empresaId,
        sucursalId: compra.sucursalId,
        articuloId: reversion.articuloId,
        tipo: 'CANCELACION_COMPRA',
        cantidad: reversion.cantidadBase,
        referenciaTipo: 'Compra',
        referenciaId: compra.id,
        usuarioId,
      });
    }

    const actualizada = await tx.compra.update({ where: { id: compraId }, data: { estado: 'CANCELADA' } });

    await registrarAuditoria(tx, {
      empresaId,
      sucursalId: compra.sucursalId,
      usuarioEjecutorId: usuarioId,
      accion: 'ACTUALIZAR',
      entidad: 'Compra',
      entidadId: compraId,
      valoresAntes: toJson({ estado: 'CONFIRMADA' }),
      valoresDespues: toJson({ estado: 'CANCELADA' }),
    });

    return actualizada;
  });
}

module.exports = { listar, obtener, crear, cancelar };
