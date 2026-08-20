const { Prisma } = require('@prisma/client');
const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');
const { aDecimalString } = require('../../../shared/decimal');

// valor llega como number crudo del body (z.coerce.number, sin redondear()) -- mismo riesgo de
// ruido de punto flotante que costo/precio en Articulo, ver shared/decimal.js. Aplica tanto para
// PORCENTAJE (0-100) como MONTO_FIJO, ambos con 2 decimales de precisión real de negocio.
function aDatosConDecimales(datos) {
  const limpios = { ...datos };
  if (limpios.valor !== undefined) limpios.valor = aDecimalString(limpios.valor);
  return limpios;
}

// A diferencia de articulos.service.js#validarReferencias (mismo tipo de referencia cruzada:
// categoriaId), este módulo no validaba que categoriaId/articuloId pertenecieran a la empresa
// del caller antes de guardarlos -- un usuario podía mandar el ID de otra empresa (encontrado en
// la ronda de QA pre-lanzamiento). Sin impacto real hoy (ventas.service.js igual filtra el
// artículo por empresa antes de aplicar el descuento, así que la referencia cruzada nunca
// coincide con nada), pero se cierra por consistencia con el resto del proyecto.
async function validarReferencias({ empresaId, categoriaId, articuloId }) {
  if (categoriaId) {
    const categoria = await prisma.categoria.findFirst({ where: { id: categoriaId, empresaId } });
    if (!categoria) throw new AppError(400, 'La categoría indicada no pertenece a esta empresa.');
  }
  if (articuloId) {
    const articulo = await prisma.articulo.findFirst({ where: { id: articuloId, empresaId } });
    if (!articulo) throw new AppError(400, 'El artículo indicado no pertenece a esta empresa.');
  }
}

async function listar({ empresaId }) {
  return prisma.descuento.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } });
}

async function crear({ empresaId, usuarioEjecutorId, datos }) {
  await validarReferencias({ empresaId, categoriaId: datos.categoriaId, articuloId: datos.articuloId });
  return prisma.$transaction(async (tx) => {
    const descuento = await tx.descuento.create({ data: { empresaId, ...aDatosConDecimales(datos) } });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'CREAR',
      entidad: 'Descuento',
      entidadId: descuento.id,
      valoresDespues: toJson(descuento),
    });
    return descuento;
  });
}

async function actualizar({ empresaId, usuarioEjecutorId, descuentoId, datos }) {
  const descuento = await prisma.descuento.findFirst({ where: { id: descuentoId, empresaId } });
  if (!descuento) throw new AppError(404, 'Descuento no encontrado.');

  await validarReferencias({ empresaId, categoriaId: datos.categoriaId, articuloId: datos.articuloId });

  return prisma.$transaction(async (tx) => {
    const actualizado = await tx.descuento.update({ where: { id: descuentoId }, data: aDatosConDecimales(datos) });
    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Descuento',
      entidadId: descuentoId,
      valoresAntes: toJson(descuento),
      valoresDespues: toJson(actualizado),
    });
    return actualizado;
  });
}

async function eliminar({ empresaId, usuarioEjecutorId, descuentoId }) {
  const descuento = await prisma.descuento.findFirst({ where: { id: descuentoId, empresaId } });
  if (!descuento) throw new AppError(404, 'Descuento no encontrado.');

  const usos = await prisma.ventaDetalle.count({ where: { descuentoId } });
  if (usos > 0) {
    throw new AppError(409, 'No se puede eliminar: ya se aplicó en ventas. Desactívalo en su lugar.');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.descuento.delete({ where: { id: descuentoId } });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'ELIMINAR',
        entidad: 'Descuento',
        entidadId: descuentoId,
        valoresAntes: toJson(descuento),
      });
    });
  } catch (error) {
    // El check de `usos` de arriba no es atómico con el delete: si una venta concurrente aplica
    // este descuento justo entre el check y el delete, el constraint de FK de la DB es la
    // última línea de defensa contra un 500 crudo en vez de un 409 de negocio.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new AppError(409, 'No se puede eliminar: ya se aplicó en ventas. Desactívalo en su lugar.');
    }
    throw error;
  }
}

module.exports = { listar, crear, actualizar, eliminar };
