const { Prisma } = require('@prisma/client');
const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { aplicarMovimiento } = require('../../../shared/services/inventario.service');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');
const { parsePaginacion, parseOrden, respuestaPaginada } = require('../../../shared/paginacion');
const { aCsv } = require('../../../shared/csv');

const COLUMNAS_ORDENABLES = {
  sucursal: 'sucursal.nombre',
  articulo: 'articulo.nombre',
  sku: 'articulo.sku',
  cantidad: 'cantidad',
};
const ORDEN_DEFECTO = [{ sucursal: { nombre: 'asc' } }, { articulo: { nombre: 'asc' } }];

// Compartido por listar() y exportarCsv(): mismos filtros aplican a ambos, para que el CSV
// exportado sea siempre exactamente lo que se está viendo en la pantalla (misma búsqueda/
// sucursal/solo-con-stock), no un volcado completo aparte.
function construirWhere({ empresaId, filtros }) {
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
  return where;
}

// `paginacion` opcional, mismo criterio que Artículos/Clientes/Proveedores: sin `pagina`
// explícita devuelve el array completo (VentasPage y useDashboardData.js lo usan para
// lookups de stock, no como tabla), solo pagina cuando el caller la pide (ExistenciasPage).
// Es la colección que más crece de las seis migradas (sucursales × artículos), así que era la
// única de las seis sin ningún `take` — antes totalmente sin límite.
async function listar({ empresaId, filtros, paginacion, ordenamiento }) {
  const where = construirWhere({ empresaId, filtros });
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
  if (articulo.tipo === 'SERVICIO') {
    throw new AppError(400, 'Un artículo tipo Servicio no lleva inventario.');
  }

  const existente = await prisma.existencia.findUnique({
    where: { sucursalId_articuloId: { sucursalId, articuloId } },
  });
  if (existente) {
    throw new AppError(
      409,
      'Ya existe una existencia para este artículo en esta sucursal; usa un ajuste para modificarla.',
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // El check de arriba no es atómico: dos establecerInicial() concurrentes sobre el mismo
      // par sucursal/artículo pasaban ambos el check y, como aplicarMovimiento usa upsert
      // (incrementa si ya existe), el segundo terminaba SUMÁNDOSE al primero en vez de
      // rechazarse — la existencia quedaba en el doble de lo esperado en vez del 409 que el
      // endpoint promete. Se crea la fila en 0 con una escritura directa (el constraint único
      // de sucursalId+articuloId es la última línea de defensa) antes de dejar que
      // aplicarMovimiento la incremente, sin duplicar su lógica de negativo/movimiento.
      await tx.existencia.create({ data: { empresaId, sucursalId, articuloId, cantidad: 0 } });

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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(
        409,
        'Ya existe una existencia para este artículo en esta sucursal; usa un ajuste para modificarla.',
      );
    }
    throw error;
  }
}

// Solo artículos activos (uno descontinuado no necesita alertar) con al menos un límite
// configurado. La comparación cantidad vs. límite no se puede expresar en el `where` de Prisma
// (compara dos columnas de tablas distintas), así que se filtra en JS igual que
// `reportes.service.js#reporteInventarioValorizado` (que ya hace lo mismo solo para stockMinimo).
async function alertas({ empresaId }) {
  const existencias = await prisma.existencia.findMany({
    where: {
      empresaId,
      articulo: { activo: true, OR: [{ stockMinimo: { not: null } }, { stockMaximo: { not: null } }] },
    },
    include: {
      articulo: { select: { id: true, nombre: true, sku: true, stockMinimo: true, stockMaximo: true } },
      sucursal: { select: { id: true, nombre: true } },
    },
  });

  const resultado = [];
  for (const e of existencias) {
    const cantidad = Number(e.cantidad);
    const { stockMinimo, stockMaximo } = e.articulo;
    if (stockMinimo !== null && cantidad <= Number(stockMinimo)) {
      resultado.push({ tipo: 'BAJO', articulo: e.articulo, sucursal: e.sucursal, cantidad, limite: stockMinimo });
    } else if (stockMaximo !== null && cantidad >= Number(stockMaximo)) {
      resultado.push({ tipo: 'ALTO', articulo: e.articulo, sucursal: e.sucursal, cantidad, limite: stockMaximo });
    }
  }

  return resultado.sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === 'BAJO' ? -1 : 1;
    return a.articulo.nombre.localeCompare(b.articulo.nombre);
  });
}

const COLUMNAS_EXPORTAR = ['sucursal', 'articulo', 'sku', 'cantidad'];

async function exportarCsv({ empresaId, filtros }) {
  const where = construirWhere({ empresaId, filtros });
  const existencias = await prisma.existencia.findMany({
    where,
    include: { articulo: true, sucursal: true },
    orderBy: ORDEN_DEFECTO,
  });

  const filas = existencias.map((e) => ({
    sucursal: e.sucursal.nombre,
    articulo: e.articulo.nombre,
    sku: e.articulo.sku || '',
    cantidad: e.cantidad,
  }));

  return aCsv(filas, COLUMNAS_EXPORTAR);
}

module.exports = { listar, establecerInicial, exportarCsv, alertas };
