const { Prisma } = require('@prisma/client');
const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');

// Traduce el constraint único de la DB (última línea de defensa cuando validarUnicidad no
// alcanza a atrapar dos altas/ediciones simultáneas con el mismo SKU/código) al mismo error de
// negocio 409 que ya lanza validarUnicidad — mismo patrón que el correo duplicado en Core.
function relanzarConflictoUnicidad(error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    if (error.meta?.target?.includes('sku')) throw new AppError(409, 'Ya existe un artículo con ese SKU.');
    if (error.meta?.target?.includes('codigoBarras')) {
      throw new AppError(409, 'Ya existe un artículo con ese código de barras.');
    }
  }
  throw error;
}

async function listar({ empresaId, filtros }) {
  const where = { empresaId };
  if (filtros.tipo) where.tipo = filtros.tipo;
  if (filtros.activo !== undefined) where.activo = filtros.activo;
  if (filtros.categoriaId) where.categoriaId = filtros.categoriaId;
  if (filtros.buscar) {
    where.OR = [
      { nombre: { contains: filtros.buscar, mode: 'insensitive' } },
      { sku: { contains: filtros.buscar, mode: 'insensitive' } },
      { codigoBarras: { contains: filtros.buscar, mode: 'insensitive' } },
    ];
  }
  return prisma.articulo.findMany({
    where,
    include: { categoria: true, marca: true, unidadBase: true, impuesto: true, precios: true },
    orderBy: { nombre: 'asc' },
  });
}

async function obtener({ empresaId, articuloId }) {
  const articulo = await prisma.articulo.findFirst({
    where: { id: articuloId, empresaId },
    include: {
      categoria: true,
      marca: true,
      unidadBase: true,
      impuesto: true,
      unidadesAlternas: { include: { unidad: true } },
      precios: { include: { listaPrecio: true } },
    },
  });
  if (!articulo) throw new AppError(404, 'Artículo no encontrado.');
  return articulo;
}

async function validarReferencias({ empresaId, datos }) {
  if (datos.unidadBaseId) {
    const unidad = await prisma.unidad.findFirst({ where: { id: datos.unidadBaseId, empresaId } });
    if (!unidad) throw new AppError(400, 'La unidad base indicada no pertenece a esta empresa.');
  }
  if (datos.categoriaId) {
    const categoria = await prisma.categoria.findFirst({ where: { id: datos.categoriaId, empresaId } });
    if (!categoria) throw new AppError(400, 'La categoría indicada no pertenece a esta empresa.');
  }
  if (datos.marcaId) {
    const marca = await prisma.marca.findFirst({ where: { id: datos.marcaId, empresaId } });
    if (!marca) throw new AppError(400, 'La marca indicada no pertenece a esta empresa.');
  }
  if (datos.impuestoId) {
    const impuesto = await prisma.impuesto.findFirst({ where: { id: datos.impuestoId, empresaId } });
    if (!impuesto) throw new AppError(400, 'El impuesto indicado no pertenece a esta empresa.');
  }
}

async function validarUnicidad({ empresaId, articuloId, sku, codigoBarras }) {
  if (sku) {
    const existente = await prisma.articulo.findUnique({ where: { empresaId_sku: { empresaId, sku } } });
    if (existente && existente.id !== articuloId) throw new AppError(409, 'Ya existe un artículo con ese SKU.');
  }
  if (codigoBarras) {
    const existente = await prisma.articulo.findUnique({
      where: { empresaId_codigoBarras: { empresaId, codigoBarras } },
    });
    if (existente && existente.id !== articuloId) {
      throw new AppError(409, 'Ya existe un artículo con ese código de barras.');
    }
  }
}

async function crear({ empresaId, usuarioEjecutorId, datos }) {
  await validarReferencias({ empresaId, datos });
  await validarUnicidad({ empresaId, articuloId: null, sku: datos.sku, codigoBarras: datos.codigoBarras });

  try {
    return await prisma.$transaction(async (tx) => {
      const articulo = await tx.articulo.create({ data: { empresaId, ...datos } });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'CREAR',
        entidad: 'Articulo',
        entidadId: articulo.id,
        valoresDespues: toJson(articulo),
      });
      return articulo;
    });
  } catch (error) {
    relanzarConflictoUnicidad(error);
  }
}

async function actualizar({ empresaId, usuarioEjecutorId, articuloId, datos }) {
  const articulo = await prisma.articulo.findFirst({ where: { id: articuloId, empresaId } });
  if (!articulo) throw new AppError(404, 'Artículo no encontrado.');

  await validarReferencias({ empresaId, datos });
  await validarUnicidad({ empresaId, articuloId, sku: datos.sku, codigoBarras: datos.codigoBarras });

  try {
    return await prisma.$transaction(async (tx) => {
      const actualizado = await tx.articulo.update({ where: { id: articuloId }, data: datos });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'ACTUALIZAR',
        entidad: 'Articulo',
        entidadId: articuloId,
        valoresAntes: toJson(articulo),
        valoresDespues: toJson(actualizado),
      });
      return actualizado;
    });
  } catch (error) {
    relanzarConflictoUnicidad(error);
  }
}

// Reemplaza el set completo de unidades alternas del artículo (mismo patrón que
// PUT /roles/:id/permisos en Core: se borra y se vuelve a crear dentro de la transacción).
async function setUnidadesAlternas({ empresaId, usuarioEjecutorId, articuloId, unidadesAlternas }) {
  const articulo = await prisma.articulo.findFirst({ where: { id: articuloId, empresaId } });
  if (!articulo) throw new AppError(404, 'Artículo no encontrado.');

  const unidadIds = unidadesAlternas.map((u) => u.unidadId);
  if (unidadIds.includes(articulo.unidadBaseId)) {
    throw new AppError(400, 'Una unidad alterna no puede ser igual a la unidad base del artículo.');
  }
  if (unidadIds.length) {
    const unidadesValidas = await prisma.unidad.findMany({ where: { id: { in: unidadIds }, empresaId } });
    if (unidadesValidas.length !== new Set(unidadIds).size) {
      throw new AppError(400, 'Alguna unidad indicada no pertenece a esta empresa o está repetida.');
    }
  }

  return prisma.$transaction(async (tx) => {
    const anteriores = await tx.unidadAlterna.findMany({ where: { articuloId } });
    await tx.unidadAlterna.deleteMany({ where: { articuloId } });
    if (unidadesAlternas.length) {
      await tx.unidadAlterna.createMany({
        data: unidadesAlternas.map((u) => ({ articuloId, unidadId: u.unidadId, factor: u.factor })),
      });
    }
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'UnidadAlterna',
      entidadId: articuloId,
      valoresAntes: toJson(anteriores),
      valoresDespues: toJson(unidadesAlternas),
    });
    return unidadesAlternas;
  });
}

// Reemplaza el set completo de precios por lista del artículo.
async function setPrecios({ empresaId, usuarioEjecutorId, articuloId, precios }) {
  const articulo = await prisma.articulo.findFirst({ where: { id: articuloId, empresaId } });
  if (!articulo) throw new AppError(404, 'Artículo no encontrado.');

  const listaIds = precios.map((p) => p.listaPrecioId);
  if (listaIds.length) {
    const listasValidas = await prisma.listaPrecio.findMany({ where: { id: { in: listaIds }, empresaId } });
    if (listasValidas.length !== new Set(listaIds).size) {
      throw new AppError(400, 'Alguna lista de precio indicada no pertenece a esta empresa o está repetida.');
    }
  }

  return prisma.$transaction(async (tx) => {
    const anteriores = await tx.precioArticulo.findMany({ where: { articuloId } });
    await tx.precioArticulo.deleteMany({ where: { articuloId } });
    if (precios.length) {
      await tx.precioArticulo.createMany({
        data: precios.map((p) => ({ articuloId, listaPrecioId: p.listaPrecioId, precio: p.precio })),
      });
    }
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'PrecioArticulo',
      entidadId: articuloId,
      valoresAntes: toJson(anteriores),
      valoresDespues: toJson(precios),
    });
    return precios;
  });
}

module.exports = { listar, obtener, crear, actualizar, setUnidadesAlternas, setPrecios };
