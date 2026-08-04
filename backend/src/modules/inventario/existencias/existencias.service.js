const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { aplicarMovimiento } = require('../../../shared/services/inventario.service');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');
const { parsePaginacion, parseOrden, respuestaPaginada } = require('../../../shared/paginacion');

const COLUMNAS_ORDENABLES = {
  sucursal: 'sucursal.nombre',
  articulo: 'articulo.nombre',
  sku: 'articulo.sku',
  cantidad: 'cantidad',
};
const ORDEN_DEFECTO = [{ sucursal: { nombre: 'asc' } }, { articulo: { nombre: 'asc' } }];

// `paginacion` opcional, mismo criterio que Artículos/Clientes/Proveedores: sin `pagina`
// explícita devuelve el array completo (VentasPage y useDashboardData.js lo usan para
// lookups de stock, no como tabla), solo pagina cuando el caller la pide (ExistenciasPage).
// Es la colección que más crece de las seis migradas (sucursales × artículos), así que era la
// única de las seis sin ningún `take` — antes totalmente sin límite.
async function listar({ empresaId, filtros, paginacion, ordenamiento }) {
  const where = { empresaId };
  if (filtros.sucursalId) where.sucursalId = filtros.sucursalId;
  if (filtros.articuloId) where.articuloId = filtros.articuloId;
  if (filtros.soloConStock) where.cantidad = { gt: 0 };
  if (filtros.buscar) {
    where.articulo = {
      OR: [
        { nombre: { contains: filtros.buscar, mode: 'insensitive' } },
        { sku: { contains: filtros.buscar, mode: 'insensitive' } },
      ],
    };
  }
  const include = { articulo: true, sucursal: true };

  if (!paginacion || paginacion.pagina === undefined) {
    return prisma.existencia.findMany({ where, include, orderBy: ORDEN_DEFECTO });
  }

  const paginado = parsePaginacion(paginacion);
  const orderBy = parseOrden(ordenamiento || {}, COLUMNAS_ORDENABLES, ORDEN_DEFECTO);

  const [datos, total] = await Promise.all([
    prisma.existencia.findMany({ where, include, orderBy, skip: paginado.skip, take: paginado.take }),
    prisma.existencia.count({ where }),
  ]);
  return respuestaPaginada(datos, total, paginado);
}

// Solo permite fijar el arranque de una existencia que todavía no existe — para corregir
// una existencia ya en uso se usa un Ajuste (§17.7), no este endpoint.
async function establecerInicial({ empresaId, usuarioId, sucursalId, articuloId, cantidad }) {
  const sucursal = await prisma.sucursal.findFirst({ where: { id: sucursalId, empresaId } });
  if (!sucursal) throw new AppError(400, 'La sucursal indicada no pertenece a esta empresa.');

  const articulo = await prisma.articulo.findFirst({ where: { id: articuloId, empresaId } });
  if (!articulo) throw new AppError(400, 'El artículo indicado no pertenece a esta empresa.');

  const existente = await prisma.existencia.findUnique({
    where: { sucursalId_articuloId: { sucursalId, articuloId } },
  });
  if (existente) {
    throw new AppError(
      409,
      'Ya existe una existencia para este artículo en esta sucursal; usa un ajuste para modificarla.',
    );
  }

  return prisma.$transaction(async (tx) => {
    const { existencia, movimiento } = await aplicarMovimiento(tx, {
      empresaId,
      sucursalId,
      articuloId,
      tipo: 'INVENTARIO_INICIAL',
      cantidad,
      referenciaTipo: 'InventarioInicial',
      referenciaId: articuloId,
      usuarioId,
    });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId: usuarioId,
      accion: 'CREAR',
      entidad: 'Existencia',
      entidadId: existencia.id,
      valoresDespues: toJson(existencia),
    });
    return { existencia, movimiento };
  });
}

module.exports = { listar, establecerInicial };
