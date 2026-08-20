const crypto = require('crypto');
const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const redondear = require('../../../shared/redondear');
const { aDecimalString } = require('../../../shared/decimal');
const toJson = require('../../../shared/toJson');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const { obtenerSiguienteFolio } = require('../../../shared/services/secuencia.service');
const { parsePaginacion, parseOrden, respuestaPaginada } = require('../../../shared/paginacion');
const plantillasService = require('../plantillas/plantillas.service');
const facturama = require('../../../shared/services/facturama.service');
const { cfdiDesdeFactura } = require('./facturas.pac');
const reintentarEscritura = require('../../../shared/reintentarEscritura');

const COLUMNAS_ORDENABLES = { folio: 'folio', total: 'total', creadoEn: 'creadoEn', estado: 'estado' };

// sucursal.<campo> ?? empresa.<campo> — comportamiento "matriz" acordado con el usuario: una
// sucursal sin datos fiscales propios factura con los de la empresa.
async function resolverEmisor({ empresaId, sucursalId }) {
  const [empresa, sucursal] = await Promise.all([
    prisma.empresa.findUnique({ where: { id: empresaId } }),
    prisma.sucursal.findFirst({ where: { id: sucursalId, empresaId } }),
  ]);
  if (!sucursal) throw new AppError(400, 'La sucursal indicada no pertenece a esta empresa.');

  const rfcEmisor = sucursal.rfc || empresa.rfc;
  const razonSocialEmisor = sucursal.razonSocial || empresa.razonSocial;
  const regimenFiscalEmisor = sucursal.regimenFiscalClave || empresa.regimenFiscalClave;
  const lugarExpedicion = sucursal.codigoPostal;

  if (!rfcEmisor || !razonSocialEmisor || !regimenFiscalEmisor) {
    throw new AppError(
      400,
      'Faltan datos fiscales de la empresa o la sucursal (RFC/razón social/régimen). Completalos en Configuración > Datos fiscales.',
    );
  }
  if (!lugarExpedicion) {
    throw new AppError(400, 'La sucursal no tiene código postal de expedición configurado.');
  }

  return { rfcEmisor, razonSocialEmisor, regimenFiscalEmisor, lugarExpedicion };
}

// c_FormaPago SAT. TARJETA no distingue crédito/débito en este POS (MetodoPago solo tiene un
// valor "TARJETA") -- se mapea a "04 Tarjeta de crédito" como aproximación razonable; ajustar
// si en el futuro el POS llega a distinguir débito/crédito.
const FORMA_PAGO_POR_METODO = { EFECTIVO: '01', TARJETA: '04', TRANSFERENCIA: '03' };

// Ventas MIXTO: se usa la forma de pago del monto mayor (decisión del usuario, 2026-08-13).
function resolverFormaPago(pagos) {
  if (!pagos || pagos.length === 0) return '99';
  const mayor = [...pagos].sort((a, b) => Number(b.monto) - Number(a.monto))[0];
  return FORMA_PAGO_POR_METODO[mayor.metodo] || '99';
}

const CLAVE_IVA_SAT = '002';

// Traslado de IVA a partir de la tasa ya congelada en VentaDetalle.impuestoTasa. Simplificación
// consciente para esta fase: siempre se asume IVA (002) -- VentaDetalle no guarda qué Impuesto
// del catálogo se usó (solo la tasa numérica), así que no hay forma de recuperar
// retenciones/IEPS después del hecho. Suficiente para Fase C (no hay timbrado real todavía);
// revisar antes de integrar el PAC si el negocio necesita IEPS/retenciones en el POS.
function trasladoDesdeTasa(tasaDecimal, baseImporte) {
  const tasa = Number(tasaDecimal);
  if (tasa <= 0) {
    return {
      objetoImpuesto: '02',
      impuestos: [{
        tipo: 'TRASLADO', impuestoClaveSat: CLAVE_IVA_SAT, tipoFactorSat: 'Exento',
        base: aDecimalString(baseImporte), tasaOCuota: null, importe: null,
      }],
    };
  }
  const importeImpuesto = redondear(baseImporte * tasa);
  return {
    objetoImpuesto: '02',
    impuestos: [{
      tipo: 'TRASLADO',
      impuestoClaveSat: CLAVE_IVA_SAT,
      tipoFactorSat: 'Tasa',
      base: aDecimalString(baseImporte),
      tasaOCuota: aDecimalString(tasa),
      importe: aDecimalString(importeImpuesto),
    }],
  };
}

// Arma los FacturaDetalle a partir de líneas de VentaDetalle (de una o varias ventas). Se
// AGRUPA por articuloId -- necesario para Global/Consolidada, donde el mismo artículo puede
// aparecer en N ventas distintas y el CFDI debe llevar un solo concepto con la cantidad total.
async function construirConceptosDesdeVentas(ventaDetalles) {
  const articuloIds = [...new Set(ventaDetalles.map((d) => d.articuloId))];
  const articulos = await prisma.articulo.findMany({
    where: { id: { in: articuloIds } },
    include: { unidadBase: true },
  });
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  const porArticulo = new Map();
  for (const d of ventaDetalles) {
    const cantidadVendida = redondear(Number(d.cantidad) - Number(d.cantidadDevuelta || 0));
    if (cantidadVendida <= 0) continue; // línea totalmente devuelta, no se factura

    const articulo = articuloPorId.get(d.articuloId);
    if (!articulo) throw new AppError(400, 'No se encontró el artículo de una de las líneas a facturar.');
    if (!articulo.claveProdServSat) {
      throw new AppError(400, `El artículo "${articulo.nombre}" no tiene clave de producto/servicio SAT configurada.`);
    }
    if (!articulo.unidadBase?.claveUnidadSat) {
      throw new AppError(400, `La unidad del artículo "${articulo.nombre}" no tiene clave de unidad SAT configurada.`);
    }

    const importeLinea = redondear(cantidadVendida * Number(d.precio) - Number(d.descuentoMonto || 0));
    const existente = porArticulo.get(d.articuloId);
    if (existente) {
      existente.cantidad = redondear(existente.cantidad + cantidadVendida);
      existente.importe = redondear(existente.importe + importeLinea);
      existente.descuento = redondear(existente.descuento + Number(d.descuentoMonto || 0));
    } else {
      porArticulo.set(d.articuloId, {
        articuloId: d.articuloId,
        claveProdServSat: articulo.claveProdServSat,
        claveUnidadSat: articulo.unidadBase.claveUnidadSat,
        descripcion: articulo.nombre,
        cantidad: cantidadVendida,
        importe: importeLinea,
        descuento: Number(d.descuentoMonto || 0),
        tasa: Number(d.impuestoTasa),
      });
    }
  }

  const conceptos = [];
  let subtotal = 0;
  let totalDescuento = 0;
  let totalImpuestosTrasladados = 0;

  for (const linea of porArticulo.values()) {
    const valorUnitario = linea.cantidad > 0 ? redondear((linea.importe + linea.descuento) / linea.cantidad) : 0;
    const { objetoImpuesto, impuestos } = trasladoDesdeTasa(linea.tasa, linea.importe);
    conceptos.push({
      articuloId: linea.articuloId,
      claveProdServSat: linea.claveProdServSat,
      claveUnidadSat: linea.claveUnidadSat,
      descripcion: linea.descripcion,
      cantidad: linea.cantidad,
      valorUnitario,
      importe: linea.importe,
      descuento: linea.descuento,
      objetoImpuesto,
      impuestos,
    });
    subtotal = redondear(subtotal + linea.importe);
    totalDescuento = redondear(totalDescuento + linea.descuento);
    const trasladoLinea = impuestos
      .filter((i) => i.tipo === 'TRASLADO')
      .reduce((acc, i) => acc + Number(i.importe || 0), 0);
    totalImpuestosTrasladados = redondear(totalImpuestosTrasladados + trasladoLinea);
  }

  const total = redondear(subtotal + totalImpuestosTrasladados);
  return { conceptos, subtotal, totalDescuento, totalImpuestosTrasladados, totalImpuestosRetenidos: 0, total };
}

// Concepto de Factura Directa: el caller (form manual) manda los ingredientes crudos, el
// backend calcula importe/impuesto -- mismo criterio de "el backend es la fuente de verdad del
// dinero" que ya sigue el resto del proyecto (Ventas no confía en totales mandados por el
// frontend tampoco).
function construirConceptoDirecta(c) {
  const importe = redondear(Number(c.cantidad) * Number(c.valorUnitario) - Number(c.descuento || 0));
  const impuestos = [];
  if (c.objetoImpuesto === '02' && c.impuesto) {
    if (c.impuesto.tipoFactorSat === 'Exento') {
      impuestos.push({
        tipo: 'TRASLADO',
        impuestoClaveSat: c.impuesto.impuestoClaveSat,
        tipoFactorSat: 'Exento',
        base: aDecimalString(importe),
        tasaOCuota: null,
        importe: null,
      });
    } else {
      const tasa = Number(c.impuesto.tasaOCuota || 0);
      const importeImpuesto = redondear(importe * tasa);
      impuestos.push({
        tipo: 'TRASLADO',
        impuestoClaveSat: c.impuesto.impuestoClaveSat,
        tipoFactorSat: c.impuesto.tipoFactorSat,
        base: aDecimalString(importe),
        tasaOCuota: aDecimalString(tasa),
        importe: aDecimalString(importeImpuesto),
      });
    }
  }
  return {
    articuloId: c.articuloId || null,
    claveProdServSat: c.claveProdServSat,
    claveUnidadSat: c.claveUnidadSat,
    descripcion: c.descripcion,
    cantidad: c.cantidad,
    valorUnitario: c.valorUnitario,
    importe,
    descuento: c.descuento || 0,
    objetoImpuesto: c.objetoImpuesto,
    impuestos,
  };
}

// Escribe Factura + FacturaDetalle + FacturaDetalleImpuesto + FacturaVenta (si aplica) + la
// auditoría, todo dentro de la MISMA transacción que ya trae el caller (que también reclamó las
// ventas involucradas ahí mismo, si corresponde) -- si algo falla acá, Postgres revierte todo
// junto, sin necesidad de liberar candados a mano.
async function persistirFactura(tx, {
  id, empresaId, sucursalId, clienteId, tipo, usuarioId, receptor, emisor,
  formaPago, metodoPago, moneda, tipoCambio, conceptos, totales, ventaIds, informacionGlobal,
}) {
  const folio = await obtenerSiguienteFolio(tx, { empresaId, sucursalId, tipoDocumento: 'FAC' });

  const factura = await tx.factura.create({
    data: {
      id,
      empresaId,
      sucursalId,
      clienteId: clienteId || null,
      tipo,
      estado: 'PENDIENTE',
      folio,
      rfcReceptor: receptor.rfc,
      nombreReceptor: receptor.nombre,
      regimenFiscalReceptor: receptor.regimenFiscal,
      usoCfdi: receptor.usoCfdi,
      domicilioFiscalReceptorCp: receptor.domicilioFiscalCp,
      rfcEmisor: emisor.rfcEmisor,
      razonSocialEmisor: emisor.razonSocialEmisor,
      regimenFiscalEmisor: emisor.regimenFiscalEmisor,
      lugarExpedicion: emisor.lugarExpedicion,
      formaPago,
      metodoPago,
      moneda: moneda || 'MXN',
      tipoCambio: tipoCambio ? aDecimalString(tipoCambio) : null,
      subtotal: aDecimalString(totales.subtotal),
      totalDescuento: aDecimalString(totales.totalDescuento),
      totalImpuestosTrasladados: aDecimalString(totales.totalImpuestosTrasladados),
      totalImpuestosRetenidos: aDecimalString(totales.totalImpuestosRetenidos || 0),
      total: aDecimalString(totales.total),
      informacionGlobalPeriodicidad: informacionGlobal?.periodicidad || null,
      informacionGlobalMeses: informacionGlobal?.meses || null,
      informacionGlobalAnio: informacionGlobal?.anio || null,
      usuarioId,
    },
  });

  for (const c of conceptos) {
    const detalle = await tx.facturaDetalle.create({
      data: {
        facturaId: factura.id,
        articuloId: c.articuloId || null,
        claveProdServSat: c.claveProdServSat,
        claveUnidadSat: c.claveUnidadSat,
        descripcion: c.descripcion,
        cantidad: aDecimalString(c.cantidad),
        valorUnitario: aDecimalString(c.valorUnitario),
        importe: aDecimalString(c.importe),
        descuento: aDecimalString(c.descuento || 0),
        objetoImpuesto: c.objetoImpuesto,
      },
    });
    if (c.impuestos?.length) {
      await tx.facturaDetalleImpuesto.createMany({
        data: c.impuestos.map((imp) => ({
          facturaDetalleId: detalle.id,
          tipo: imp.tipo,
          impuestoClaveSat: imp.impuestoClaveSat,
          tipoFactorSat: imp.tipoFactorSat,
          base: imp.base,
          tasaOCuota: imp.tasaOCuota,
          importe: imp.importe,
        })),
      });
    }
  }

  if (ventaIds?.length) {
    await tx.facturaVenta.createMany({ data: ventaIds.map((ventaId) => ({ facturaId: factura.id, ventaId })) });
  }

  await registrarAuditoria(tx, {
    empresaId,
    sucursalId,
    usuarioEjecutorId: usuarioId,
    accion: 'CREAR',
    entidad: 'Factura',
    entidadId: factura.id,
    folio: factura.folio,
    valoresDespues: toJson({ tipo, total: totales.total, rfcReceptor: receptor.rfc }),
  });

  return tx.factura.findUnique({
    where: { id: factura.id },
    include: { detalles: { include: { impuestos: true } } },
  });
}

// Fase F: timbra ante el PAC una factura ya persistida localmente (estado PENDIENTE o ERROR de
// un intento previo, o TIMBRADA sin XML -- ver más abajo). Corre FUERA de cualquier transacción
// de Prisma a propósito -- es una llamada de red al PAC, no debe mantener conexiones/locks de la
// DB abiertos mientras espera. Si facturama.timbrar() falla, la Factura local queda en estado
// ERROR (no se revierte su creación: la venta ya está reclamada y el documento existe, solo
// falta timbrarlo) y se devuelve igual el registro con un campo `errorTimbrado` transitorio (no
// persistido) para que el caller lo muestre.
async function intentarTimbrar(factura) {
  let timbre;
  try {
    timbre = await facturama.timbrar(cfdiDesdeFactura(factura));
  } catch (err) {
    const actualizada = await prisma.factura.update({
      where: { id: factura.id },
      data: { estado: 'ERROR' },
      include: { detalles: { include: { impuestos: true } } },
    });
    return { ...actualizada, errorTimbrado: err.publicMessage || 'No se pudo timbrar la factura.' };
  }

  // A partir de acá el CFDI YA EXISTE legalmente en el SAT (tiene UUID) -- se persiste TIMBRADA
  // de inmediato, antes de intentar bajar el XML. Bug real encontrado y corregido en la tercera
  // ronda de QA (2026-08-18): la versión anterior hacía las dos llamadas dentro del mismo
  // try/catch, así que si facturama.timbrar() tenía éxito pero obtenerXmlBase64() fallaba
  // después (ej. timeout de red), el catch marcaba la factura como ERROR sin guardar el
  // pacId/uuid ya obtenidos -- un "reintentar" desde ese estado volvía a llamar
  // facturama.timbrar(), generando un SEGUNDO CFDI duplicado ante el SAT para la misma venta.
  // Bajar el XML ahora es best-effort y reintentable por separado (ver `descargarXml` más abajo)
  // sin volver a timbrar nunca.
  let xmlTimbrado = null;
  try {
    xmlTimbrado = await facturama.obtenerXmlBase64(timbre.pacId);
  } catch {
    // No-op a propósito: el CFDI ya es válido aunque no se haya podido bajar el XML todavía.
  }

  // Encontrado en la ronda de QA pre-lanzamiento: este UPDATE (el que persiste que el CFDI ya
  // existe en el SAT) no tenía ningún manejo de error -- un blip transitorio de conexión acá
  // (no la llamada al PAC, que ya tuvo éxito arriba) dejaba la Factura en su estado previo sin
  // pacId/uuid guardados en ningún lado, y `timbrar()` la volvía a mandar por intentarTimbrar()
  // en el siguiente intento, generando un SEGUNDO CFDI real duplicado ante el SAT. Se reintenta
  // unas pocas veces (mismo motivo que ya justificó separar la descarga del XML del timbrado en
  // sí, ver comentario de arriba) antes de rendirse.
  try {
    return await reintentarEscritura(() => prisma.factura.update({
      where: { id: factura.id },
      data: {
        estado: 'TIMBRADA',
        pacId: timbre.pacId,
        uuid: timbre.uuid,
        fechaTimbrado: new Date(timbre.fechaTimbrado),
        selloSAT: timbre.selloSAT,
        noCertificadoSAT: timbre.noCertificadoSAT,
        cadenaOriginal: timbre.cadenaOriginal,
        xmlTimbrado,
      },
      include: { detalles: { include: { impuestos: true } } },
    }));
  } catch (error) {
    // Se agotaron los reintentos: el CFDI quedó timbrado de verdad en el SAT pero no se pudo
    // reflejar localmente. Se loguea como CRÍTICO con todos los identificadores necesarios para
    // reconciliar a mano -- NO se debe volver a llamar facturama.timbrar() para esta factura.
    // eslint-disable-next-line no-console
    console.error(
      'CRÍTICO: CFDI timbrado en el SAT pero no se pudo persistir localmente tras reintentos.',
      { facturaId: factura.id, empresaId: factura.empresaId, pacId: timbre.pacId, uuid: timbre.uuid },
    );
    throw new AppError(
      500,
      'La factura se timbró ante el SAT pero no se pudo guardar en el sistema. NO reintentes -- contactá soporte con este folio.',
    );
  }
}

// Reintenta SOLO bajar el XML de una factura que ya quedó TIMBRADA en el PAC (pacId existe) pero
// sin xmlTimbrado persistido -- nunca vuelve a llamar facturama.timbrar(), justamente para no
// generar un CFDI duplicado (ver comentario en intentarTimbrar).
async function reintentarXml(factura) {
  const xmlTimbrado = await facturama.obtenerXmlBase64(factura.pacId);
  return prisma.factura.update({
    where: { id: factura.id },
    data: { xmlTimbrado },
    include: { detalles: { include: { impuestos: true } } },
  });
}

// Reintento manual (factura quedó en ERROR, o PENDIENTE si el timbrado automático nunca corrió;
// o TIMBRADA sin XML por el bug descrito en intentarTimbrar, para facturas que quedaron en ese
// estado antes del fix).
async function timbrar({ empresaId, facturaId }) {
  const factura = await prisma.factura.findFirst({
    where: { id: facturaId, empresaId },
    include: { detalles: { include: { impuestos: true } } },
  });
  if (!factura) throw new AppError(404, 'Factura no encontrada.');
  if (factura.estado === 'CANCELADA') throw new AppError(400, 'Esta factura está cancelada.');
  if (factura.estado === 'TIMBRADA') {
    if (factura.xmlTimbrado) throw new AppError(400, 'Esta factura ya está timbrada.');
    return reintentarXml(factura);
  }
  return intentarTimbrar(factura);
}

// Mismo criterio que ventas.service.js (que sí valida clienteId contra empresaId antes de
// usarlo): Factura.clienteId/FacturaPlantilla.clienteId son FKs simples, no compuestas con
// empresaId, así que sin este chequeo un clienteId de otra empresa (adivinado o filtrado) se
// persistía igual -- encontrado en la ronda de QA pre-lanzamiento. Hoy sin impacto activo (nada
// lista facturas por clienteId sin también filtrar por empresaId), pero es el mismo tipo de
// defensa en profundidad que ya existe en el resto del proyecto.
async function validarClientePropio({ empresaId, clienteId }) {
  if (!clienteId) return;
  const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, empresaId } });
  if (!cliente) throw new AppError(400, 'El cliente indicado no pertenece a esta empresa.');
}

// Flujo 1: Factura Directa, sin venta previa del POS.
async function crearDirecta({ empresaId, sucursalId, usuarioId, receptor, conceptos: conceptosCrudos, formaPago, metodoPago, moneda, tipoCambio }) {
  await validarClientePropio({ empresaId, clienteId: receptor.clienteId });
  const emisor = await resolverEmisor({ empresaId, sucursalId });
  const conceptos = conceptosCrudos.map(construirConceptoDirecta);

  const subtotal = redondear(conceptos.reduce((acc, c) => acc + c.importe, 0));
  const totalDescuento = redondear(conceptos.reduce((acc, c) => acc + Number(c.descuento || 0), 0));
  const totalImpuestosTrasladados = redondear(
    conceptos.reduce(
      (acc, c) => acc + c.impuestos.filter((i) => i.tipo === 'TRASLADO').reduce((a, i) => a + Number(i.importe || 0), 0),
      0,
    ),
  );
  const total = redondear(subtotal + totalImpuestosTrasladados);
  const totales = { subtotal, totalDescuento, totalImpuestosTrasladados, totalImpuestosRetenidos: 0, total };

  const id = crypto.randomUUID();
  const factura = await prisma.$transaction((tx) => persistirFactura(tx, {
    id, empresaId, sucursalId, clienteId: receptor.clienteId, tipo: 'DIRECTA', usuarioId,
    receptor, emisor, formaPago, metodoPago, moneda, tipoCambio, conceptos, totales,
  }));
  return intentarTimbrar(factura);
}

// Flujos 2 y 3: Facturar una venta del POS (VENTA_POS, autenticado) o Auto-facturación
// (AUTOFACTURACION, portal público -- se cablea en la Fase E, esta función ya queda lista para
// reusarse ahí). Candado anti-duplicado: Venta.facturaId se reclama con un
// UPDATE...WHERE factura_id IS NULL dentro de la MISMA transacción que crea la Factura --
// mismo patrón que Cotizacion.convertidaEnVentaId, pero todo en una sola transacción (más
// simple: si algo falla, Postgres revierte todo junto, sin liberar candados a mano).
async function crearDesdeVenta({ empresaId, usuarioId, tipo, ventaId, receptor }) {
  const venta = await prisma.venta.findFirst({
    where: { id: ventaId, empresaId },
    include: { pagos: true },
  });
  if (!venta) throw new AppError(404, 'Venta no encontrada.');
  if (venta.estado !== 'CONFIRMADA') throw new AppError(400, 'Solo se pueden facturar ventas confirmadas.');
  if (venta.facturaId) throw new AppError(409, 'Esta venta ya fue facturada.');

  const emisor = await resolverEmisor({ empresaId, sucursalId: venta.sucursalId });
  const formaPago = resolverFormaPago(venta.pagos);
  const id = crypto.randomUUID();

  const factura = await prisma.$transaction(async (tx) => {
    // El candado reclama facturaId Y estado a la vez -- reclamar solo facturaId dejaba una
    // ventana real: si un cancelar() concurrente pasaba su propio candado (que solo reclama
    // estado) mientras esta transacción ya estaba en curso, la venta terminaba CANCELADA con
    // stock revertido pero facturaId apuntando a una Factura recién TIMBRADA (CFDI legal en el
    // SAT para una venta que el POS dice que nunca ocurrió). Verificado en vivo disparando
    // crearDesdeVenta y ventas.cancelar en paralelo sobre la misma venta (2026-08-18, tercera
    // ronda de QA): ambas tuvieron éxito antes de este fix.
    const reclamada = await tx.venta.updateMany({
      where: { id: ventaId, facturaId: null, estado: 'CONFIRMADA' },
      data: { facturaId: id },
    });
    if (reclamada.count === 0) throw new AppError(409, 'Esta venta ya fue facturada o cancelada.');

    // Los detalles (con cantidadDevuelta) se releen ACÁ, después del candado, no antes de la
    // transacción -- releerlos antes dejaba una ventana real: una devolución podía commitear
    // entre esa lectura y este punto, y el CFDI se armaba igual con las cantidades
    // pre-devolución, timbrando de más ante el SAT (encontrado en la ronda de QA
    // pre-lanzamiento). El candado de arriba y el FOR UPDATE que devoluciones.service.js toma
    // sobre esta misma fila de venta se serializan entre sí (mismo row lock de Postgres), así
    // que para cuando este punto se alcanza cualquier devolución que ya haya ganado la carrera
    // quedó commiteada antes de esta lectura.
    const detallesFrescos = await tx.ventaDetalle.findMany({ where: { ventaId } });
    const { conceptos, ...totales } = await construirConceptosDesdeVentas(detallesFrescos);
    if (conceptos.length === 0) throw new AppError(400, 'La venta no tiene líneas facturables (todo fue devuelto).');

    return persistirFactura(tx, {
      id, empresaId, sucursalId: venta.sucursalId, clienteId: venta.clienteId, tipo, usuarioId,
      receptor, emisor, formaPago, metodoPago: 'PUE', moneda: 'MXN', tipoCambio: null,
      conceptos, totales, ventaIds: [ventaId],
    });
  });
  return intentarTimbrar(factura);
}

// Flujo 4: Factura Global (público en general, RFC genérico) o Consolidada (N ventas de UN
// cliente identificado) -- mismo mecanismo de agrupación N:1 vía FacturaVenta, solo cambia
// quién arma `ventaIds` (el caller) y el receptor. Candado sobre TODAS las ventas a la vez,
// todo o nada: si alguna ya fue reclamada por otra solicitud simultánea, la transacción entera
// se revierte (Postgres deshace también las que sí se alcanzaron a marcar en este intento).
async function crearAgrupada({ empresaId, sucursalId, usuarioId, tipo, ventaIds, receptor, informacionGlobal }) {
  await validarClientePropio({ empresaId, clienteId: receptor.clienteId });
  const ventas = await prisma.venta.findMany({
    where: { id: { in: ventaIds }, empresaId, sucursalId, estado: 'CONFIRMADA', facturaId: null },
    include: { pagos: true },
  });
  if (ventas.length !== ventaIds.length) {
    throw new AppError(
      409,
      'Alguna de las ventas seleccionadas ya fue facturada, no está confirmada, o no pertenece a esta sucursal.',
    );
  }

  const emisor = await resolverEmisor({ empresaId, sucursalId });
  const id = crypto.randomUUID();

  const factura = await prisma.$transaction(async (tx) => {
    // Mismo fix que crearDesdeVenta: reclamar facturaId Y estado a la vez, para no dejar la
    // misma ventana de carrera con un cancelar() concurrente sobre alguna de las ventas.
    const reclamadas = await tx.venta.updateMany({
      where: { id: { in: ventaIds }, facturaId: null, estado: 'CONFIRMADA' },
      data: { facturaId: id },
    });
    if (reclamadas.count !== ventaIds.length) {
      throw new AppError(409, 'Alguna de las ventas seleccionadas ya fue facturada o cancelada por otra solicitud simultánea.');
    }

    // Mismo motivo que crearDesdeVenta: releer los detalles (cantidadDevuelta) DESPUÉS del
    // candado, no antes -- evita timbrar cantidades pre-devolución si una devolución ganó la
    // carrera sobre alguna de las ventas del grupo.
    const detallesFrescos = await tx.ventaDetalle.findMany({ where: { ventaId: { in: ventaIds } } });
    const { conceptos, ...totales } = await construirConceptosDesdeVentas(detallesFrescos);
    if (conceptos.length === 0) throw new AppError(400, 'Las ventas seleccionadas no tienen líneas facturables.');

    return persistirFactura(tx, {
      id, empresaId, sucursalId, clienteId: receptor.clienteId, tipo, usuarioId,
      receptor, emisor, formaPago: '99', metodoPago: 'PUE', moneda: 'MXN', tipoCambio: null,
      conceptos, totales, ventaIds, informacionGlobal: tipo === 'GLOBAL' ? informacionGlobal : null,
    });
  });
  return intentarTimbrar(factura);
}

// Candidatas para agrupar (Global: soloPublicoGeneral; Consolidada: clienteId puntual) -- el
// frontend arma `ventaIds` a partir de esta lista antes de llamar crearAgrupada.
async function listarVentasFacturables({ empresaId, sucursalId, clienteId, soloPublicoGeneral, desde, hasta }) {
  const where = { empresaId, sucursalId, estado: 'CONFIRMADA', facturaId: null };
  if (clienteId) where.clienteId = clienteId;
  if (soloPublicoGeneral) where.cliente = { esGeneral: true };
  if (desde || hasta) {
    where.creadoEn = {};
    if (desde) where.creadoEn.gte = new Date(desde);
    if (hasta) where.creadoEn.lte = new Date(hasta);
  }
  return prisma.venta.findMany({ where, include: { cliente: true }, orderBy: { creadoEn: 'asc' } });
}

// Cancelación (CFDI 4.0 exige motivo). Libera Venta.facturaId de las ventas asociadas para que
// puedan volver a facturarse. Mismo candado que el resto del proyecto para el estado
// (UPDATE...WHERE estado != 'CANCELADA'), todo dentro de una transacción.
async function cancelar({ empresaId, usuarioId, facturaId, claveMotivoCancelacion, facturaSustitutaId }) {
  const factura = await prisma.factura.findFirst({ where: { id: facturaId, empresaId } });
  if (!factura) throw new AppError(404, 'Factura no encontrada.');
  if (factura.estado === 'CANCELADA') throw new AppError(400, 'Esta factura ya está cancelada.');

  // Solo avisa al PAC si esta factura llegó a timbrarse de verdad (tiene pacId/uuid) -- una
  // factura en PENDIENTE/ERROR nunca se mandó al SAT, no hay nada que cancelar allá. Se hace
  // ANTES de tocar el estado local: si el PAC rechaza la cancelación, no se marca CANCELADA acá.
  if (factura.pacId) {
    let uuidSustituto;
    if (facturaSustitutaId) {
      const sustituta = await prisma.factura.findFirst({ where: { id: facturaSustitutaId, empresaId } });
      uuidSustituto = sustituta?.uuid;
    }
    await facturama.cancelar({ pacId: factura.pacId, motivo: claveMotivoCancelacion, uuidSustituto });
  }

  // A partir de acá el CFDI YA está cancelado de verdad ante el SAT (si tenía pacId) -- mismo
  // riesgo que en intentarTimbrar (ver comentario ahí, encontrado en la misma ronda de QA
  // pre-lanzamiento): un blip transitorio en esta transacción local no debe traducirse en volver
  // a llamar facturama.cancelar() en un reintento, así que se reintenta la escritura local unas
  // pocas veces antes de rendirse.
  try {
    return await reintentarEscritura(() => prisma.$transaction(async (tx) => {
      const reclamada = await tx.factura.updateMany({
        where: { id: facturaId, estado: { not: 'CANCELADA' } },
        data: { estado: 'CANCELADA', claveMotivoCancelacion, facturaSustitutaId: facturaSustitutaId || null },
      });
      if (reclamada.count === 0) throw new AppError(400, 'Esta factura ya está cancelada.');

      const ventasFactura = await tx.facturaVenta.findMany({ where: { facturaId }, select: { ventaId: true } });
      if (ventasFactura.length > 0) {
        await tx.venta.updateMany({
          where: { id: { in: ventasFactura.map((v) => v.ventaId) } },
          data: { facturaId: null },
        });
      }

      await registrarAuditoria(tx, {
        empresaId,
        sucursalId: factura.sucursalId,
        usuarioEjecutorId: usuarioId,
        accion: 'CANCELAR',
        entidad: 'Factura',
        entidadId: factura.id,
        folio: factura.folio,
        motivo: claveMotivoCancelacion,
        valoresAntes: toJson({ estado: factura.estado }),
        valoresDespues: toJson({ estado: 'CANCELADA', claveMotivoCancelacion }),
      });

      return tx.factura.findUnique({ where: { id: facturaId } });
    }));
  } catch (error) {
    if (factura.pacId) {
      // eslint-disable-next-line no-console
      console.error(
        'CRÍTICO: CFDI cancelado en el SAT pero no se pudo persistir localmente tras reintentos.',
        { facturaId: factura.id, empresaId, pacId: factura.pacId },
      );
    }
    throw error;
  }
}

async function listar({ empresaId, filtros, paginacion, ordenamiento }) {
  const where = { empresaId };
  if (filtros?.tipo) where.tipo = filtros.tipo;
  if (filtros?.estado) where.estado = filtros.estado;
  if (filtros?.buscar) {
    where.OR = [
      { folio: { contains: filtros.buscar, mode: 'insensitive' } },
      { rfcReceptor: { contains: filtros.buscar, mode: 'insensitive' } },
      { nombreReceptor: { contains: filtros.buscar, mode: 'insensitive' } },
    ];
  }

  const paginado = parsePaginacion(paginacion);
  const orderBy = parseOrden(ordenamiento || {}, COLUMNAS_ORDENABLES, { creadoEn: 'desc' });

  const [datos, total] = await Promise.all([
    prisma.factura.findMany({ where, orderBy, skip: paginado.skip, take: paginado.take }),
    prisma.factura.count({ where }),
  ]);
  return respuestaPaginada(datos, total, paginado);
}

// Captura rápida de Factura Directa: primero busca una FacturaPlantilla (Fase 2 -- predeterminada,
// o si no hay ninguna marcada, la usada más recientemente) y solo si no existe ninguna cae a
// sugerir repetir la última factura emitida a este cliente desde esta sucursal (Fase 1). Ambas
// están acotadas a la misma pareja cliente+sucursal. include.detalles.impuestos en el camino de
// Factura para que el frontend pueda reconstruir un concepto congelado completo si el articuloId
// ya no existe/está inactivo (ver FacturaDirectaPage).
async function obtenerSugerencia({ empresaId, sucursalId, clienteId }) {
  const plantilla = await plantillasService.obtenerSugerida({ empresaId, sucursalId, clienteId });
  if (plantilla) return { origen: 'PLANTILLA', plantilla };

  const factura = await prisma.factura.findFirst({
    where: { empresaId, sucursalId, clienteId, estado: { not: 'CANCELADA' } },
    orderBy: { creadoEn: 'desc' },
    include: { detalles: { include: { impuestos: true } } },
  });
  if (factura) return { origen: 'FACTURA', factura };

  return null;
}

async function obtener({ empresaId, facturaId }) {
  const factura = await prisma.factura.findFirst({
    where: { id: facturaId, empresaId },
    include: { detalles: { include: { impuestos: true } }, ventas: true },
  });
  if (!factura) throw new AppError(404, 'Factura no encontrada.');
  return factura;
}

module.exports = {
  crearDirecta,
  crearDesdeVenta,
  crearAgrupada,
  listarVentasFacturables,
  obtenerSugerencia,
  cancelar,
  timbrar,
  listar,
  obtener,
};
