const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');

async function listar({ empresaId, sucursalId, clienteId }) {
  return prisma.facturaPlantilla.findMany({
    where: { empresaId, sucursalId, clienteId },
    include: { conceptos: { orderBy: { orden: 'asc' } } },
    orderBy: [{ esPredeterminada: 'desc' }, { ultimoUso: 'desc' }, { creadoEn: 'desc' }],
  });
}

// La sugerida para el banner de captura rápida: la predeterminada si hay una, si no la usada
// más recientemente -- misma cascada documentada en la propuesta de Fase 2.
async function obtenerSugerida({ empresaId, sucursalId, clienteId }) {
  return prisma.facturaPlantilla.findFirst({
    where: { empresaId, sucursalId, clienteId },
    include: { conceptos: { orderBy: { orden: 'asc' } } },
    orderBy: [{ esPredeterminada: 'desc' }, { ultimoUso: 'desc' }, { creadoEn: 'desc' }],
  });
}

async function crear({ empresaId, sucursalId, clienteId, nombre, esPredeterminada, formaPago, metodoPago, conceptos }) {
  const articuloIds = conceptos.map((c) => c.articuloId);
  const encontrados = await prisma.articulo.count({ where: { id: { in: articuloIds }, empresaId } });
  if (encontrados !== new Set(articuloIds).size) {
    throw new AppError(400, 'Alguno de los artículos de la plantilla no pertenece a esta empresa.');
  }

  // sucursalId/clienteId no se validaban contra empresaId como sí se hace con articuloId arriba
  // (encontrado en la ronda de QA pre-lanzamiento) -- mismo criterio que
  // facturas.service.js#validarClientePropio.
  if (sucursalId) {
    const sucursal = await prisma.sucursal.findFirst({ where: { id: sucursalId, empresaId } });
    if (!sucursal) throw new AppError(400, 'La sucursal indicada no pertenece a esta empresa.');
  }
  if (clienteId) {
    const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, empresaId } });
    if (!cliente) throw new AppError(400, 'El cliente indicado no pertenece a esta empresa.');
  }

  return prisma.$transaction(async (tx) => {
    if (esPredeterminada) {
      await tx.facturaPlantilla.updateMany({
        where: { empresaId, sucursalId, clienteId, esPredeterminada: true },
        data: { esPredeterminada: false },
      });
    }
    return tx.facturaPlantilla.create({
      data: {
        empresaId,
        sucursalId,
        clienteId,
        nombre,
        esPredeterminada,
        formaPago,
        metodoPago,
        conceptos: {
          create: conceptos.map((c, i) => ({
            articuloId: c.articuloId,
            cantidadHabitual: c.cantidadHabitual,
            orden: i,
          })),
        },
      },
      include: { conceptos: true },
    });
  });
}

async function actualizar({ empresaId, plantillaId, nombre, esPredeterminada }) {
  const plantilla = await prisma.facturaPlantilla.findFirst({ where: { id: plantillaId, empresaId } });
  if (!plantilla) throw new AppError(404, 'Plantilla no encontrada.');

  return prisma.$transaction(async (tx) => {
    if (esPredeterminada) {
      await tx.facturaPlantilla.updateMany({
        where: { empresaId, sucursalId: plantilla.sucursalId, clienteId: plantilla.clienteId, esPredeterminada: true },
        data: { esPredeterminada: false },
      });
    }
    return tx.facturaPlantilla.update({
      where: { id: plantillaId },
      data: { ...(nombre !== undefined && { nombre }), ...(esPredeterminada !== undefined && { esPredeterminada }) },
      include: { conceptos: true },
    });
  });
}

async function eliminar({ empresaId, plantillaId }) {
  const plantilla = await prisma.facturaPlantilla.findFirst({ where: { id: plantillaId, empresaId } });
  if (!plantilla) throw new AppError(404, 'Plantilla no encontrada.');
  await prisma.facturaPlantillaConcepto.deleteMany({ where: { facturaPlantillaId: plantillaId } });
  await prisma.facturaPlantilla.delete({ where: { id: plantillaId } });
}

// Se llama al aplicar la plantilla en la captura ("Usar como base") -- solo lleva la cuenta de
// uso para poder ordenar "la más frecuente" cuando no hay ninguna marcada predeterminada; no
// bloquea ni valida nada más.
async function registrarUso({ empresaId, plantillaId }) {
  const plantilla = await prisma.facturaPlantilla.findFirst({ where: { id: plantillaId, empresaId } });
  if (!plantilla) throw new AppError(404, 'Plantilla no encontrada.');
  await prisma.facturaPlantilla.update({
    where: { id: plantillaId },
    data: { usoContador: { increment: 1 }, ultimoUso: new Date() },
  });
}

module.exports = { listar, obtenerSugerida, crear, actualizar, eliminar, registrarUso };
