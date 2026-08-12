const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { obtenerSiguienteFolio } = require('../../../shared/services/secuencia.service');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const { enviarCorreoConAdjunto } = require('../../../shared/services/correo.service');
const toJson = require('../../../shared/toJson');
const redondear = require('../../../shared/redondear');
const { parsePaginacion, parseOrden, respuestaPaginada } = require('../../../shared/paginacion');
// Reusa ventas.service.js#crear en vez de duplicar la transacción de venta — es un sub-recurso
// del mismo módulo (MOD-008), no un import entre módulos distintos (§3.1 solo prohíbe eso).
const ventasService = require('../ventas/ventas.service');

const COLUMNAS_ORDENABLES = { folio: 'folio', total: 'total', creadoEn: 'creadoEn' };

// Único consumidor de esta lista (CotizacionesPage), a diferencia de Artículos/Clientes/
// Proveedores/Ajustes/Existencias/Usuarios — no necesita modo dual, siempre pagina (mismo
// criterio que Ventas/Compras/Auditoría).
async function listar({ empresaId, filtros, paginacion, ordenamiento }) {
  // Cotizacion no declara relación de Prisma hacia Cliente (ver obtener() más abajo), así que
  // solo se puede buscar por folio acá sin una consulta manual extra.
  const where = { empresaId };
  if (filtros?.buscar) where.folio = { contains: filtros.buscar, mode: 'insensitive' };

  const paginado = parsePaginacion(paginacion);
  const orderBy = parseOrden(ordenamiento || {}, COLUMNAS_ORDENABLES, { creadoEn: 'desc' });

  const [datos, total] = await Promise.all([
    prisma.cotizacion.findMany({ where, orderBy, skip: paginado.skip, take: paginado.take }),
    prisma.cotizacion.count({ where }),
  ]);
  return respuestaPaginada(datos, total, paginado);
}

// Cotizacion no declara relaciones de Prisma hacia Cliente/Sucursal (solo guarda los IDs
// crudos), a diferencia de Venta — por eso cliente/sucursal/artículos se resuelven acá con
// consultas manuales en vez de un `include`, mismo patrón que ya usaba esta función para
// artículos.
async function obtener({ empresaId, cotizacionId }) {
  const cotizacion = await prisma.cotizacion.findFirst({
    where: { id: cotizacionId, empresaId },
    include: { detalles: true },
  });
  if (!cotizacion) throw new AppError(404, 'Cotización no encontrada.');

  const articuloIds = [...new Set(cotizacion.detalles.map((d) => d.articuloId))];
  const [cliente, sucursal, articulos] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: cotizacion.clienteId } }),
    prisma.sucursal.findUnique({ where: { id: cotizacion.sucursalId } }),
    prisma.articulo.findMany({
      where: { id: { in: articuloIds } },
      select: { id: true, nombre: true, sku: true },
    }),
  ]);
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  return {
    ...cotizacion,
    cliente,
    sucursal,
    detalles: cotizacion.detalles.map((d) => ({ ...d, articulo: articuloPorId.get(d.articuloId) || null })),
  };
}

// Descuento manual por línea (sin catálogo, a diferencia de Ventas) — mismo cálculo que la
// rama `descuentoManual` de `resolverDescuentoLinea` en ventas.service.js, pero sin los mapas
// de descuentos/promociones de catálogo que acá no aplican. Sin chequeo de permiso: cargar un
// descuento manual en una cotización no lo exige (solo convertirla en venta, ver convertir()).
function calcularDescuentoManual(cantidad, precio, descuentoManual) {
  if (!descuentoManual) return 0;
  const { tipo, valor } = descuentoManual;
  const bruto = cantidad * precio;
  return tipo === 'PORCENTAJE' ? bruto * (Number(valor) / 100) : Math.min(Number(valor), bruto);
}

// Sin movimiento de stock ni de caja — es un borrador. El precio de línea no exige permisos
// especiales aquí (no es dinero real todavía); si se manda uno distinto al de catálogo, el
// chequeo de venta.modificar_precio/aplicar_descuento se aplica al convertir (ver abajo),
// que es el momento en que el precio sí se vuelve una transacción real. Mismo criterio para el
// descuento manual por línea.
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
  // Misma resolución de precio por lista que Ventas, para que el total de la cotización
  // coincida con lo que realmente se cobrará al convertirla (§ ventas.service#resolverPreciosCatalogo).
  const preciosLista = await ventasService.resolverPreciosCatalogo({
    articuloIds,
    listaPrecioId: cliente.listaPrecioId,
  });

  const lineas = detalles.map((d) => {
    const precioCatalogo = preciosLista.has(d.articuloId)
      ? preciosLista.get(d.articuloId)
      : Number(articuloPorId.get(d.articuloId).precio);
    const precio = d.precio !== undefined ? d.precio : precioCatalogo;
    return {
      articuloId: d.articuloId,
      cantidad: d.cantidad,
      precio,
      descuentoMonto: calcularDescuentoManual(d.cantidad, precio, d.descuentoManual),
    };
  });
  const total = redondear(lineas.reduce((acc, l) => acc + (l.cantidad * l.precio - l.descuentoMonto), 0));

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
        descuentoMonto: l.descuentoMonto,
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

const RESERVADO = 'RESERVADO';

// La venta y el marcado de convertidaEnVentaId no comparten transacción: en el caso raro de
// que la venta se cree pero este segundo paso falle, la cotización queda sin marcar pero la
// venta sigue siendo válida — no hay pérdida de datos financieros, solo de la referencia cruzada.
//
// El check-then-act de "no convertida todavía" sí necesita ser atómico: dos conversiones casi
// simultáneas de la misma cotización podían pasar ambas la lectura y generar dos ventas (stock
// y caja duplicados). Se reclama la cotización con un UPDATE...WHERE convertidaEnVentaId IS NULL
// (Postgres serializa esa fila) antes de crear la venta; si el conteo da 0, alguien más ya la
// reclamó. Si la creación de la venta falla, se libera el candado.
async function convertir({ empresaId, usuarioId, rolId, cotizacionId, sesionCajaId, pagos, autorizadoPorId }) {
  const cotizacion = await prisma.cotizacion.findFirst({
    where: { id: cotizacionId, empresaId },
    include: { detalles: true },
  });
  if (!cotizacion) throw new AppError(404, 'Cotización no encontrada.');
  if (cotizacion.convertidaEnVentaId) throw new AppError(400, 'Esta cotización ya fue convertida en venta.');

  const reclamada = await prisma.cotizacion.updateMany({
    where: { id: cotizacionId, convertidaEnVentaId: null },
    data: { convertidaEnVentaId: RESERVADO },
  });
  if (reclamada.count === 0) throw new AppError(400, 'Esta cotización ya fue convertida en venta.');

  let venta;
  try {
    venta = await ventasService.crear({
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
        // El descuento de la cotización solo puede ser manual (sin catálogo) — se reconstruye
        // como MONTO_FIJO con el monto ya congelado; determinístico porque cantidad/precio no
        // cambian, así que Math.min(descuentoMonto, bruto) en resolverDescuentoLinea reproduce
        // el mismo monto exacto.
        ...(Number(d.descuentoMonto) > 0 && {
          descuentoManual: { tipo: 'MONTO_FIJO', valor: Number(d.descuentoMonto) },
        }),
      })),
      pagos,
      autorizadoPorId,
    });
  } catch (error) {
    await prisma.cotizacion.update({ where: { id: cotizacionId }, data: { convertidaEnVentaId: null } });
    throw error;
  }

  await prisma.cotizacion.update({ where: { id: cotizacionId }, data: { convertidaEnVentaId: venta.id } });

  return venta;
}

// Reusa la cotización ya persistida solo para el folio/sucursal (auditoría) y el asunto por
// defecto — el PDF ya viene armado desde el frontend en base64 (mismo criterio del logo de
// empresa: el backend no genera PDFs, ver correo.service.js).
async function enviar({
  empresaId, usuarioId, cotizacionId, destinatario, asunto, mensaje, adjuntoBase64, nombreArchivo,
}) {
  const cotizacion = await prisma.cotizacion.findFirst({ where: { id: cotizacionId, empresaId } });
  if (!cotizacion) throw new AppError(404, 'Cotización no encontrada.');

  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
  const asuntoFinal = asunto || `Cotización ${cotizacion.folio} — ${empresa?.nombreComercial || 'BOX POS'}`;

  await enviarCorreoConAdjunto({
    destinatario,
    asunto: asuntoFinal,
    mensaje,
    adjunto: { nombreArchivo, contenidoBase64: adjuntoBase64 },
  });

  await registrarAuditoria(null, {
    empresaId,
    sucursalId: cotizacion.sucursalId,
    usuarioEjecutorId: usuarioId,
    accion: 'ENVIAR_CORREO',
    entidad: 'Cotizacion',
    entidadId: cotizacion.id,
    folio: cotizacion.folio,
    valoresDespues: toJson({ destinatario }),
  });

  return { enviado: true };
}

module.exports = {
  listar, obtener, crear, convertir, enviar,
};
