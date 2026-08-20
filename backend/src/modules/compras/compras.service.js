const prisma = require('../../config/db');
const AppError = require('../../shared/errors/AppError');
const { aplicarMovimiento } = require('../../shared/services/inventario.service');
const { obtenerSiguienteFolio } = require('../../shared/services/secuencia.service');
const { registrarAuditoria } = require('../../shared/services/auditoria.service');
const { enviarCorreoConAdjunto } = require('../../shared/services/correo.service');
const toJson = require('../../shared/toJson');
const redondear = require('../../shared/redondear');
const { aDecimalString } = require('../../shared/decimal');
const { parsePaginacion, parseOrden, respuestaPaginada } = require('../../shared/paginacion');

const COLUMNAS_ORDENABLES = {
  folio: 'folio',
  proveedor: 'proveedor.nombre',
  total: 'total',
  estado: 'estado',
  creadoEn: 'creadoEn',
};

async function listar({ empresaId, filtros, paginacion, ordenamiento }) {
  const where = { empresaId };
  if (filtros.proveedorId) where.proveedorId = filtros.proveedorId;
  if (filtros.sucursalId) where.sucursalId = filtros.sucursalId;
  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.desde || filtros.hasta) {
    where.creadoEn = {};
    if (filtros.desde) where.creadoEn.gte = new Date(filtros.desde);
    if (filtros.hasta) where.creadoEn.lte = new Date(filtros.hasta);
  }
  if (filtros.buscar) {
    where.OR = [
      { folio: { contains: filtros.buscar, mode: 'insensitive' } },
      { proveedor: { nombre: { contains: filtros.buscar, mode: 'insensitive' } } },
    ];
  }

  const paginado = parsePaginacion(paginacion);
  const orderBy = parseOrden(ordenamiento || {}, COLUMNAS_ORDENABLES, { creadoEn: 'desc' });

  const [datos, total] = await Promise.all([
    prisma.compra.findMany({
      where,
      include: { proveedor: true, sucursal: true, ordenCompra: { select: { folio: true } } },
      orderBy,
      skip: paginado.skip,
      take: paginado.take,
    }),
    prisma.compra.count({ where }),
  ]);

  return respuestaPaginada(datos, total, paginado);
}

async function obtener({ empresaId, compraId }) {
  const compra = await prisma.compra.findFirst({
    where: { id: compraId, empresaId },
    include: { detalles: true, proveedor: true, sucursal: true },
  });
  if (!compra) throw new AppError(404, 'Compra no encontrada.');

  const articuloIds = [...new Set(compra.detalles.map((d) => d.articuloId))];
  const unidadIds = [...new Set(compra.detalles.map((d) => d.unidadId))];
  const [articulos, unidades] = await Promise.all([
    prisma.articulo.findMany({ where: { id: { in: articuloIds } }, select: { id: true, nombre: true, sku: true, imagenUrl: true } }),
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

// Descuento manual por línea (sin catálogo — Compras no tiene Descuento/Promocion) — mismo
// cálculo que cotizaciones.service.js#calcularDescuentoManual. Se aplica sobre cantidad×costo,
// ANTES del impuesto (igual que Ventas/Cotizaciones).
function calcularDescuentoManual(cantidad, costo, descuentoManual) {
  if (!descuentoManual) return 0;
  const { tipo, valor } = descuentoManual;
  const bruto = cantidad * costo;
  return tipo === 'PORCENTAJE' ? bruto * (Number(valor) / 100) : Math.min(Number(valor), bruto);
}

async function crear({
  empresaId, usuarioId, sucursalId, proveedorId, folioProveedor, observaciones, detalles, ordenCompraId,
}) {
  const sucursal = await prisma.sucursal.findFirst({ where: { id: sucursalId, empresaId } });
  if (!sucursal) throw new AppError(400, 'La sucursal indicada no pertenece a esta empresa.');

  const proveedor = await prisma.proveedor.findFirst({ where: { id: proveedorId, empresaId } });
  if (!proveedor) throw new AppError(400, 'El proveedor indicado no pertenece a esta empresa.');
  if (!proveedor.activo) throw new AppError(400, 'El proveedor está inactivo y no se le pueden registrar compras.');

  // Recepción contra una Orden de Compra — siempre opcional (ver ordenes/ordenes.service.js).
  // Se valida que la orden coincida en empresa/proveedor/sucursal y esté en un estado que
  // todavía puede recibir algo; el resto (qué líneas de la orden se completan) se resuelve
  // dentro de la transacción, con los detalles ya cargados acá para no repetir la consulta.
  let ordenCompra = null;
  if (ordenCompraId) {
    ordenCompra = await prisma.ordenCompra.findFirst({
      where: { id: ordenCompraId, empresaId },
      include: { detalles: true },
    });
    if (!ordenCompra) throw new AppError(400, 'La orden de compra indicada no existe.');
    if (ordenCompra.proveedorId !== proveedorId || ordenCompra.sucursalId !== sucursalId) {
      throw new AppError(400, 'La orden de compra indicada es de otro proveedor o sucursal.');
    }
    if (!['ENVIADA', 'PARCIAL'].includes(ordenCompra.estado)) {
      throw new AppError(400, 'Esta orden de compra ya no admite más recepciones.');
    }
  }

  const articuloIds = detalles.map((d) => d.articuloId);
  const articulos = await prisma.articulo.findMany({
    where: { id: { in: articuloIds }, empresaId },
    include: { impuesto: true },
  });
  if (articulos.length !== new Set(articuloIds).size) {
    throw new AppError(400, 'Algún artículo indicado no pertenece a esta empresa o está repetido.');
  }
  // Un Kit no tiene existencia propia (se descompone en sus componentes al venderse) — no se
  // recibe de un proveedor como una unidad; lo que llega son sus componentes por separado.
  if (articulos.some((a) => a.tipo === 'KIT')) {
    throw new AppError(400, 'Un artículo tipo Kit no se puede comprar directamente — recibe sus componentes por separado.');
  }
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  const lineas = [];
  for (const detalle of detalles) {
    const articulo = articuloPorId.get(detalle.articuloId);
    const factor = await resolverFactor({ articulo, unidadId: detalle.unidadId });
    lineas.push({
      ...detalle,
      factor,
      cantidadBase: detalle.cantidad * factor,
      descuentoMonto: calcularDescuentoManual(detalle.cantidad, detalle.costo, detalle.descuentoManual),
      // Tasa del impuesto configurado en el artículo, congelada al registrar la compra — mismo
      // criterio que VentaDetalle/CotizacionDetalle.impuestoTasa (§3.14). Simplificación
      // consciente: igual que Facturación (ver facturas.service.js), se asume que el impuesto
      // del artículo es IVA; si en el futuro se necesitan otros impuestos por línea de compra,
      // revisar acá primero.
      impuestoTasa: articulo.impuesto ? Number(articulo.impuesto.tasa) : 0,
    });
  }

  const subtotal = redondear(lineas.reduce((acc, l) => acc + (l.cantidad * l.costo - l.descuentoMonto), 0));
  const impuestos = redondear(
    lineas.reduce((acc, l) => acc + (l.cantidad * l.costo - l.descuentoMonto) * l.impuestoTasa, 0),
  );
  const total = redondear(subtotal + impuestos);

  return prisma.$transaction(async (tx) => {
    const folio = await obtenerSiguienteFolio(tx, { empresaId, sucursalId, tipoDocumento: 'COM' });

    const compra = await tx.compra.create({
      data: {
        empresaId, sucursalId, proveedorId, usuarioId, folio,
        subtotal: aDecimalString(subtotal),
        impuestos: aDecimalString(impuestos),
        total: aDecimalString(total),
        folioProveedor, observaciones,
        ordenCompraId: ordenCompra?.id,
      },
    });

    await tx.compraDetalle.createMany({
      data: lineas.map((l) => ({
        compraId: compra.id,
        articuloId: l.articuloId,
        unidadId: l.unidadId,
        cantidad: l.cantidad,
        costo: aDecimalString(l.costo),
        descuentoMonto: aDecimalString(l.descuentoMonto),
        impuestoTasa: aDecimalString(l.impuestoTasa),
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

      // "Último costo" (§16.3), expresado en unidad base — SIN impuesto ni descuento, mismo
      // costo bruto que ya se usaba antes de este cambio (no se prorratea el descuento acá, para
      // no alterar un comportamiento ya existente y verificado). Se actualiza solo al confirmar,
      // no se revierte al cancelar (documentado en el plan de esta fase).
      await tx.articulo.update({
        where: { id: linea.articuloId },
        data: { costo: aDecimalString(linea.costo / linea.factor) },
      });
    }

    // Si esta compra es la recepción de una orden, acredita lo recibido contra cada línea que
    // coincida por artículo (una compra "desde orden" puede además traer artículos que no
    // estaban pedidos — no rompen nada, solo no afectan el conteo de pendientes) y recalcula el
    // estado de la orden. Todo dentro de la misma transacción para que orden y compra queden
    // consistentes o fallen juntas.
    if (ordenCompra) {
      // Bloquea la fila de la orden ANTES de leer/recalcular su estado -- los increments de
      // cantidadRecibidaBase de abajo son atómicos a nivel SQL (no pierden datos bajo
      // concurrencia), pero sin este lock dos recepciones simultáneas contra la MISMA orden
      // podían cada una leer los totales antes de que la otra confirmara su incremento y
      // terminar pisando el `estado` de la orden con un valor desactualizado (ej. quedar en
      // PARCIAL cuando en realidad, sumando ambas recepciones, ya estaba RECIBIDA). Mismo patrón
      // FOR UPDATE ya usado en devoluciones/sesiones_caja para serializar exactamente este tipo
      // de lectura-antes-de-recalcular.
      // Se relee el estado bajo el lock y se vuelve a validar -- el check de arriba (línea 133)
      // no es atómico con esta transacción: sin esto, un cerrar()/cancelar() concurrente de la
      // orden (que sí reclama con su propio UPDATE...WHERE) podía cerrarla mientras esta
      // recepción seguía en curso, y como acá se comparaba contra el `estado` leído ANTES de la
      // transacción, la recepción igual completaba las líneas y "reabría" la orden a
      // RECIBIDA/PARCIAL, pisando el cierre manual (encontrado en la ronda de QA pre-lanzamiento).
      const [ordenLock] = await tx.$queryRaw`SELECT estado FROM ordenes_compra WHERE id = ${ordenCompra.id} FOR UPDATE`;
      if (!['ENVIADA', 'PARCIAL'].includes(ordenLock.estado)) {
        throw new AppError(400, 'Esta orden de compra ya no admite más recepciones.');
      }

      const detallePorArticulo = new Map(ordenCompra.detalles.map((d) => [d.articuloId, d]));
      for (const linea of lineas) {
        const detalleOrden = detallePorArticulo.get(linea.articuloId);
        if (!detalleOrden) continue;
        await tx.ordenCompraDetalle.update({
          where: { id: detalleOrden.id },
          data: { cantidadRecibidaBase: { increment: linea.cantidadBase } },
        });
      }

      const detallesActualizados = await tx.ordenCompraDetalle.findMany({ where: { ordenCompraId: ordenCompra.id } });
      const completa = detallesActualizados.every((d) => Number(d.cantidadRecibidaBase) >= Number(d.cantidadBase));
      const algoRecibido = detallesActualizados.some((d) => Number(d.cantidadRecibidaBase) > 0);
      const nuevoEstado = completa ? 'RECIBIDA' : (algoRecibido ? 'PARCIAL' : ordenLock.estado);
      if (nuevoEstado !== ordenLock.estado) {
        await tx.ordenCompra.update({ where: { id: ordenCompra.id }, data: { estado: nuevoEstado } });
      }
    }

    await registrarAuditoria(tx, {
      empresaId,
      sucursalId,
      usuarioEjecutorId: usuarioId,
      accion: 'CREAR',
      entidad: 'Compra',
      entidadId: compra.id,
      folio,
      valoresDespues: toJson({
        proveedorId, subtotal, impuestos, total, folioProveedor, observaciones, detalles: lineas,
      }),
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

  // Si esta compra fue una recepción, cancelarla debe liberar lo acreditado contra la orden
  // (si no, la orden quedaría "Recibida"/"Parcial" con mercancía que en realidad se devolvió).
  // Se resuelve antes de la transacción para no repetir esta consulta; el estado real se
  // recalcula ya dentro de la transacción con los datos frescos.
  const ordenCompra = compra.ordenCompraId
    ? await prisma.ordenCompra.findUnique({ where: { id: compra.ordenCompraId }, include: { detalles: true } })
    : null;

  return prisma.$transaction(async (tx) => {
    // El check de arriba no es atómico con el resto: dos cancelar() casi simultáneos pasaban
    // ambos el check y aplicaban la reversión de stock dos veces (mismo patrón que
    // transferencias.recibir en Inventario y el resto de las condiciones de carrera encontradas
    // en cada módulo de este QA). Se reclama la compra con un UPDATE...WHERE estado='CONFIRMADA'
    // antes de aplicar los movimientos.
    const reclamada = await tx.compra.updateMany({
      where: { id: compraId, estado: 'CONFIRMADA' },
      data: { estado: 'CANCELADA' },
    });
    if (reclamada.count === 0) {
      throw new AppError(400, 'Solo se pueden cancelar compras confirmadas.');
    }

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

    // Simétrico a la acreditación en crear(): descuenta lo que esta compra había sumado a cada
    // línea de la orden y recalcula el estado — salvo que la orden ya esté CERRADA a mano (una
    // decisión manual de que "no va a llegar más" no debe reabrirse solo porque se canceló una
    // recepción vieja).
    if (ordenCompra) {
      // Mismo lock que en crear() -- serializa contra cualquier otra recepción/cancelación
      // concurrente sobre esta orden antes de leer su estado real (no el snapshot de antes de la
      // transacción) y recalcular. Se relee el estado fresco acá porque el snapshot de arriba
      // (`ordenCompra`, leído antes de la transacción) puede haber quedado desactualizado.
      const [ordenActual] = await tx.$queryRaw`SELECT estado FROM ordenes_compra WHERE id = ${ordenCompra.id} FOR UPDATE`;

      if (ordenActual.estado !== 'CERRADA') {
        const detallePorArticulo = new Map(ordenCompra.detalles.map((d) => [d.articuloId, d]));
        for (const reversion of reversiones) {
          const detalleOrden = detallePorArticulo.get(reversion.articuloId);
          if (!detalleOrden) continue;
          await tx.ordenCompraDetalle.update({
            where: { id: detalleOrden.id },
            data: { cantidadRecibidaBase: { decrement: reversion.cantidadBase } },
          });
        }

        const detallesActualizados = await tx.ordenCompraDetalle.findMany({ where: { ordenCompraId: ordenCompra.id } });
        const completa = detallesActualizados.every((d) => Number(d.cantidadRecibidaBase) >= Number(d.cantidadBase));
        const algoRecibido = detallesActualizados.some((d) => Number(d.cantidadRecibidaBase) > 0);
        const nuevoEstado = completa ? 'RECIBIDA' : (algoRecibido ? 'PARCIAL' : 'ENVIADA');
        if (nuevoEstado !== ordenActual.estado) {
          await tx.ordenCompra.update({ where: { id: ordenCompra.id }, data: { estado: nuevoEstado } });
        }
      }
    }

    const actualizada = await tx.compra.findUnique({ where: { id: compraId } });

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

// Mismo criterio que cotizaciones.service.js#enviar: el PDF ya viene armado desde el frontend
// en base64, acá solo se resuelve el folio/empresa para el asunto por defecto y se audita.
async function enviar({
  empresaId, usuarioId, compraId, destinatario, asunto, mensaje, adjuntoBase64, nombreArchivo,
}) {
  const compra = await prisma.compra.findFirst({ where: { id: compraId, empresaId } });
  if (!compra) throw new AppError(404, 'Compra no encontrada.');

  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
  const asuntoFinal = asunto || `Compra ${compra.folio} — ${empresa?.nombreComercial || 'BOX POS'}`;

  await enviarCorreoConAdjunto({
    destinatario,
    asunto: asuntoFinal,
    mensaje,
    adjunto: { nombreArchivo, contenidoBase64: adjuntoBase64 },
  });

  await registrarAuditoria(null, {
    empresaId,
    sucursalId: compra.sucursalId,
    usuarioEjecutorId: usuarioId,
    accion: 'ENVIAR_CORREO',
    entidad: 'Compra',
    entidadId: compra.id,
    folio: compra.folio,
    valoresDespues: toJson({ destinatario }),
  });

  return { enviado: true };
}

module.exports = {
  listar, obtener, crear, cancelar, enviar,
  // Reusada por ordenes/ordenes.service.js (mismo módulo top-level "compras", no viola §3.1) —
  // una Orden de Compra necesita el mismo cálculo de factor unidad→base al congelar
  // OrdenCompraDetalle.cantidadBase.
  resolverFactor,
};
