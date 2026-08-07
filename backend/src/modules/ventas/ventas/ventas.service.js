const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { aplicarMovimiento } = require('../../../shared/services/inventario.service');
const { registrarMovimientoCaja } = require('../../../shared/services/caja.service');
const { obtenerSiguienteFolio } = require('../../../shared/services/secuencia.service');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const { usuarioTienePermiso } = require('../../../shared/services/permisos.service');
const toJson = require('../../../shared/toJson');
const redondear = require('../../../shared/redondear');
const { parsePaginacion, parseOrden, respuestaPaginada } = require('../../../shared/paginacion');

const COLUMNAS_ORDENABLES = {
  folio: 'folio',
  cliente: 'cliente.nombre',
  total: 'total',
  estado: 'estado',
  creadoEn: 'creadoEn',
};

// Precio "de catálogo" efectivo para un cliente: el de su lista de precio asignada
// (PrecioArticulo) si tiene una y el artículo tiene un precio ahí definido; si no,
// el precio base del artículo. Reusado por cotizaciones.service.js (mismo módulo, MOD-008)
// para que una cotización y la venta en la que se convierte partan del mismo precio base.
async function resolverPreciosCatalogo({ articuloIds, listaPrecioId }) {
  const precios = new Map();
  if (listaPrecioId) {
    const porLista = await prisma.precioArticulo.findMany({
      where: { articuloId: { in: articuloIds }, listaPrecioId },
    });
    for (const p of porLista) precios.set(p.articuloId, Number(p.precio));
  }
  return precios;
}

async function listar({ empresaId, filtros, paginacion, ordenamiento }) {
  const where = { empresaId };
  if (filtros.clienteId) where.clienteId = filtros.clienteId;
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
      { cliente: { nombre: { contains: filtros.buscar, mode: 'insensitive' } } },
    ];
  }

  const paginado = parsePaginacion(paginacion);
  const orderBy = parseOrden(ordenamiento || {}, COLUMNAS_ORDENABLES, { creadoEn: 'desc' });

  const [datos, total] = await Promise.all([
    prisma.venta.findMany({
      where,
      include: { cliente: true, sucursal: true },
      orderBy,
      skip: paginado.skip,
      take: paginado.take,
    }),
    prisma.venta.count({ where }),
  ]);

  return respuestaPaginada(datos, total, paginado);
}

async function obtener({ empresaId, ventaId }) {
  const venta = await prisma.venta.findFirst({
    where: { id: ventaId, empresaId },
    include: {
      cliente: true,
      sucursal: true,
      detalles: { include: { descuento: true, promocion: true } },
      pagos: true,
    },
  });
  if (!venta) throw new AppError(404, 'Venta no encontrada.');

  const articuloIds = [...new Set(venta.detalles.map((d) => d.articuloId))];
  const articulos = await prisma.articulo.findMany({
    where: { id: { in: articuloIds } },
    select: { id: true, nombre: true, sku: true },
  });
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  return {
    ...venta,
    detalles: venta.detalles.map((d) => ({ ...d, articulo: articuloPorId.get(d.articuloId) || null })),
  };
}

// Resuelve el descuento/promoción preconfigurado de una línea (catalogo.descuentos /
// catalogo.promociones) contra el artículo/cantidad/precio ya resueltos de esa línea.
// No hace ninguna consulta — recibe los mapas ya cargados para no golpear la DB por línea.
function resolverDescuentoLinea({ detalle, articulo, cantidad, precio, descuentoPorId, promocionPorId }) {
  const ahora = new Date();

  // Descuento cargado directo en la venta (no ligado a catalogo.descuentos) — sin chequeos de
  // alcance/vigencia porque no hay registro de catálogo detrás; SIEMPRE exige aprobación de
  // supervisor, a diferencia de descuentoId/promocionId, que ya vienen "pre-aprobados" por
  // existir en el catálogo (ver crear() más abajo).
  if (detalle.descuentoManual) {
    const { tipo, valor } = detalle.descuentoManual;
    const bruto = cantidad * precio;
    const monto = tipo === 'PORCENTAJE' ? bruto * (Number(valor) / 100) : Math.min(Number(valor), bruto);
    return { descuentoId: null, promocionId: null, descuentoMonto: monto, requiereAprobacion: true };
  }

  if (detalle.descuentoId) {
    const descuento = descuentoPorId.get(detalle.descuentoId);
    if (!descuento) throw new AppError(400, 'El descuento indicado no existe o no pertenece a esta empresa.');
    if (!descuento.activo) throw new AppError(400, `El descuento "${descuento.nombre}" ya no está activo.`);
    if (descuento.vigenciaDesde && ahora < descuento.vigenciaDesde) {
      throw new AppError(400, `El descuento "${descuento.nombre}" todavía no está vigente.`);
    }
    if (descuento.vigenciaHasta && ahora > descuento.vigenciaHasta) {
      throw new AppError(400, `El descuento "${descuento.nombre}" ya no está vigente.`);
    }
    if (descuento.alcance === 'CATEGORIA' && articulo.categoriaId !== descuento.categoriaId) {
      throw new AppError(400, `El descuento "${descuento.nombre}" no aplica a este artículo.`);
    }
    if (descuento.alcance === 'ARTICULO' && articulo.id !== descuento.articuloId) {
      throw new AppError(400, `El descuento "${descuento.nombre}" no aplica a este artículo.`);
    }

    const bruto = cantidad * precio;
    const monto =
      descuento.tipo === 'PORCENTAJE'
        ? bruto * (Number(descuento.valor) / 100)
        : Math.min(Number(descuento.valor), bruto);
    return { descuentoId: descuento.id, promocionId: null, descuentoMonto: monto, requiereAprobacion: descuento.requiereAprobacion };
  }

  if (detalle.promocionId) {
    const promocion = promocionPorId.get(detalle.promocionId);
    if (!promocion) throw new AppError(400, 'La promoción indicada no existe o no pertenece a esta empresa.');
    if (!promocion.activo) throw new AppError(400, `La promoción "${promocion.nombre}" ya no está activa.`);
    if (promocion.vigenciaDesde && ahora < promocion.vigenciaDesde) {
      throw new AppError(400, `La promoción "${promocion.nombre}" todavía no está vigente.`);
    }
    if (promocion.vigenciaHasta && ahora > promocion.vigenciaHasta) {
      throw new AppError(400, `La promoción "${promocion.nombre}" ya no está vigente.`);
    }
    if (promocion.alcance === 'CATEGORIA' && articulo.categoriaId !== promocion.categoriaId) {
      throw new AppError(400, `La promoción "${promocion.nombre}" no aplica a este artículo.`);
    }
    if (promocion.alcance === 'ARTICULO' && articulo.id !== promocion.articuloId) {
      throw new AppError(400, `La promoción "${promocion.nombre}" no aplica a este artículo.`);
    }
    if (cantidad < promocion.cantidadRequerida) {
      throw new AppError(
        400,
        `La promoción "${promocion.nombre}" requiere al menos ${promocion.cantidadRequerida} unidades de este artículo.`,
      );
    }

    const gruposCompletos = Math.floor(cantidad / promocion.cantidadRequerida);
    const unidadesGratis = gruposCompletos * promocion.cantidadGratis;
    const monto = unidadesGratis * precio;
    return { descuentoId: null, promocionId: promocion.id, descuentoMonto: monto, requiereAprobacion: promocion.requiereAprobacion };
  }

  return { descuentoId: null, promocionId: null, descuentoMonto: 0, requiereAprobacion: false };
}

// Precio/tasa de impuesto se congelan por línea (§20.9, §3.14). Un precio manual distinto al
// de catálogo exige permiso: más bajo = venta.aplicar_descuento, más alto = venta.modificar_precio
// (el schema no tiene un campo "descuento" separado — un descuento ES un precio de línea menor).
// Un descuento/promoción de catálogo (distinto del override manual de arriba) resta
// descuentoMonto de la línea; si el registro tiene requiereAprobacion=true, la venta entera
// exige autorizadoPorId con permiso venta.autorizar_descuento (ver resolverDescuentoLinea).
async function crear({
  empresaId,
  usuarioId,
  rolId,
  sucursalId,
  clienteId,
  sesionCajaId,
  detalles,
  pagos,
  autorizadoPorId,
}) {
  const sucursal = await prisma.sucursal.findFirst({ where: { id: sucursalId, empresaId } });
  if (!sucursal) throw new AppError(400, 'La sucursal indicada no pertenece a esta empresa.');

  const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, empresaId } });
  if (!cliente) throw new AppError(400, 'El cliente indicado no pertenece a esta empresa.');
  if (!cliente.activo) throw new AppError(400, 'El cliente está inactivo y no se le pueden registrar ventas.');

  const articuloIds = detalles.map((d) => d.articuloId);
  const articulos = await prisma.articulo.findMany({
    where: { id: { in: articuloIds }, empresaId },
    include: { impuesto: true },
  });
  if (articulos.length !== new Set(articuloIds).size) {
    throw new AppError(400, 'Algún artículo indicado no pertenece a esta empresa o está repetido.');
  }
  if (articulos.some((a) => !a.activo)) {
    throw new AppError(400, 'Algún artículo indicado está descontinuado y no se puede vender.');
  }
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));
  const preciosLista = await resolverPreciosCatalogo({ articuloIds, listaPrecioId: cliente.listaPrecioId });

  const descuentoIds = [...new Set(detalles.map((d) => d.descuentoId).filter(Boolean))];
  const promocionIds = [...new Set(detalles.map((d) => d.promocionId).filter(Boolean))];
  const [descuentos, promociones] = await Promise.all([
    descuentoIds.length ? prisma.descuento.findMany({ where: { id: { in: descuentoIds }, empresaId } }) : [],
    promocionIds.length ? prisma.promocion.findMany({ where: { id: { in: promocionIds }, empresaId } }) : [],
  ]);
  const descuentoPorId = new Map(descuentos.map((d) => [d.id, d]));
  const promocionPorId = new Map(promociones.map((p) => [p.id, p]));

  const lineas = [];
  for (const detalle of detalles) {
    const articulo = articuloPorId.get(detalle.articuloId);
    const precioCatalogo = preciosLista.has(detalle.articuloId)
      ? preciosLista.get(detalle.articuloId)
      : Number(articulo.precio);
    let precio = precioCatalogo;

    if (detalle.precio !== undefined && detalle.precio !== precioCatalogo) {
      precio = detalle.precio;
      const clave = precio < precioCatalogo ? 'venta.aplicar_descuento' : 'venta.modificar_precio';
      const tienePermiso = await usuarioTienePermiso({ usuarioId, rolId, clave });
      if (!tienePermiso) {
        const accion = precio < precioCatalogo ? 'aplicar descuentos' : 'modificar el precio';
        throw new AppError(403, `No tienes permiso para ${accion} en esta línea.`);
      }
    }

    let descuentoInfo = { descuentoId: null, promocionId: null, descuentoMonto: 0, requiereAprobacion: false };
    if (detalle.descuentoManual) {
      // Solo el descuento manual (no ligado a catálogo) exige el permiso venta.aplicar_descuento
      // — es la acción discrecional del cajero. Un descuentoId/promocionId de catálogo se aplica
      // solo (ver más abajo), sin gating de permiso, porque ya fue aprobado al configurarse.
      const tienePermiso = await usuarioTienePermiso({ usuarioId, rolId, clave: 'venta.aplicar_descuento' });
      if (!tienePermiso) throw new AppError(403, 'No tienes permiso para aplicar descuentos.');
      descuentoInfo = resolverDescuentoLinea({
        detalle,
        articulo,
        cantidad: detalle.cantidad,
        precio,
        descuentoPorId,
        promocionPorId,
      });
    } else if (detalle.descuentoId || detalle.promocionId) {
      descuentoInfo = resolverDescuentoLinea({
        detalle,
        articulo,
        cantidad: detalle.cantidad,
        precio,
        descuentoPorId,
        promocionPorId,
      });
    }

    const impuestoTasa = articulo.impuesto ? Number(articulo.impuesto.tasa) : 0;
    const descuentoNombre = detalle.descuentoManual
      ? 'Descuento manual'
      : descuentoInfo.descuentoId
        ? descuentoPorId.get(descuentoInfo.descuentoId)?.nombre
        : null;
    const promocionNombre = descuentoInfo.promocionId ? promocionPorId.get(descuentoInfo.promocionId)?.nombre : null;
    lineas.push({
      articuloId: detalle.articuloId,
      cantidad: detalle.cantidad,
      precio,
      impuestoTasa,
      ...descuentoInfo,
      descuentoNombre,
      promocionNombre,
    });
  }

  if (lineas.some((l) => l.requiereAprobacion)) {
    if (!autorizadoPorId) {
      throw new AppError(400, 'Esta venta incluye un descuento/promoción que requiere autorización de un supervisor.');
    }
    const autorizador = await prisma.usuarioEmpresa.findUnique({
      where: { usuarioId_empresaId: { usuarioId: autorizadoPorId, empresaId } },
    });
    if (!autorizador) throw new AppError(400, 'El usuario autorizador indicado no pertenece a esta empresa.');
    const puedeAutorizar = await usuarioTienePermiso({
      usuarioId: autorizadoPorId,
      rolId: autorizador.rolId,
      clave: 'venta.autorizar_descuento',
    });
    if (!puedeAutorizar) {
      throw new AppError(403, 'El usuario elegido para autorizar no tiene permiso para autorizar descuentos/promociones.');
    }
  }

  const subtotal = redondear(lineas.reduce((acc, l) => acc + (l.cantidad * l.precio - l.descuentoMonto), 0));
  const impuestos = redondear(
    lineas.reduce((acc, l) => acc + (l.cantidad * l.precio - l.descuentoMonto) * l.impuestoTasa, 0),
  );
  const total = redondear(subtotal + impuestos);

  const sumaPagos = redondear(pagos.reduce((acc, p) => acc + p.monto, 0));
  if (Math.abs(sumaPagos - total) > 0.01) {
    throw new AppError(
      400,
      `La suma de los pagos (${sumaPagos.toFixed(2)}) no coincide con el total (${total.toFixed(2)}).`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const folio = await obtenerSiguienteFolio(tx, { empresaId, sucursalId, tipoDocumento: 'VTA' });

    const venta = await tx.venta.create({
      data: {
        empresaId,
        sucursalId,
        clienteId,
        usuarioId,
        sesionCajaId,
        folio,
        subtotal,
        impuestos,
        total,
        autorizadoPorId: autorizadoPorId || null,
      },
    });

    await tx.ventaDetalle.createMany({
      data: lineas.map((l) => ({
        ventaId: venta.id,
        articuloId: l.articuloId,
        cantidad: l.cantidad,
        precio: l.precio,
        impuestoTasa: l.impuestoTasa,
        descuentoId: l.descuentoId,
        promocionId: l.promocionId,
        descuentoMonto: l.descuentoMonto,
      })),
    });

    await tx.pago.createMany({
      data: pagos.map((p) => ({ ventaId: venta.id, metodo: p.metodo, monto: p.monto })),
    });

    for (const linea of lineas) {
      await aplicarMovimiento(tx, {
        empresaId,
        sucursalId,
        articuloId: linea.articuloId,
        tipo: 'SALIDA_VENTA',
        cantidad: linea.cantidad,
        referenciaTipo: 'Venta',
        referenciaId: venta.id,
        usuarioId,
      });
    }

    await registrarMovimientoCaja(tx, {
      empresaId,
      sesionCajaId,
      sucursalId,
      tipo: 'VENTA',
      monto: total,
      referenciaTipo: 'Venta',
      referenciaId: venta.id,
      usuarioId,
    });

    await registrarAuditoria(tx, {
      empresaId,
      sucursalId,
      usuarioEjecutorId: usuarioId,
      accion: 'CREAR',
      entidad: 'Venta',
      entidadId: venta.id,
      folio,
      valoresDespues: toJson({ clienteId, subtotal, impuestos, total, detalles }),
    });

    return { ...venta, detalles: lineas, pagos };
  });
}

// No revierte el movimiento de caja (mismo corte deliberado que "cancelar no revierte el
// último costo" en Compras, Fase 5) — si hace falta ajustar el efectivo, es un RETIRO manual.
async function cancelar({ empresaId, usuarioId, ventaId }) {
  const venta = await prisma.venta.findFirst({ where: { id: ventaId, empresaId }, include: { detalles: true } });
  if (!venta) throw new AppError(404, 'Venta no encontrada.');
  if (venta.estado !== 'CONFIRMADA') throw new AppError(400, 'Solo se pueden cancelar ventas confirmadas.');

  return prisma.$transaction(async (tx) => {
    for (const detalle of venta.detalles) {
      await aplicarMovimiento(tx, {
        empresaId,
        sucursalId: venta.sucursalId,
        articuloId: detalle.articuloId,
        tipo: 'CANCELACION_VENTA',
        cantidad: Number(detalle.cantidad),
        referenciaTipo: 'Venta',
        referenciaId: venta.id,
        usuarioId,
      });
    }

    const actualizada = await tx.venta.update({ where: { id: ventaId }, data: { estado: 'CANCELADA' } });

    await registrarAuditoria(tx, {
      empresaId,
      sucursalId: venta.sucursalId,
      usuarioEjecutorId: usuarioId,
      accion: 'ACTUALIZAR',
      entidad: 'Venta',
      entidadId: ventaId,
      valoresAntes: toJson({ estado: 'CONFIRMADA' }),
      valoresDespues: toJson({ estado: 'CANCELADA' }),
    });

    return actualizada;
  });
}

module.exports = { listar, obtener, crear, cancelar, resolverPreciosCatalogo };
