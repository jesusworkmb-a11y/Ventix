const { Prisma } = require('@prisma/client');
const prisma = require('../../config/db');
const redondear = require('../../shared/redondear');
const AppError = require('../../shared/errors/AppError');
const { registrarAuditoria } = require('../../shared/services/auditoria.service');
const { enviarCorreoConAdjunto } = require('../../shared/services/correo.service');
const toJson = require('../../shared/toJson');

// Mismo mapa de signo que aplicarMovimiento (shared/services/inventario.service.js) -- el
// Kardex necesita reproducir exactamente ese cálculo para que la "Existencia" de cada renglón
// coincida con la que ya quedó escrita en Existencia.cantidad, no una versión aparte que podría
// desincronizarse.
const TIPOS_ENTRADA = [
  'ENTRADA_COMPRA', 'ENTRADA_DEVOLUCION', 'AJUSTE_ENTRADA', 'INVENTARIO_INICIAL', 'TRANSFERENCIA_ENTRADA', 'CANCELACION_VENTA',
];

const ETIQUETA_SIN_FOLIO = {
  InventarioInicial: 'Existencia inicial',
  ConteoFisico: 'Conteo físico',
};

// Resuelve "Documento" (folio legible) para cada renglón del Kardex -- MovimientoInventario solo
// guarda referenciaTipo/referenciaId crudos (ver schema.prisma), así que hay que ir a buscar el
// folio a la tabla de origen correspondiente. Batcheado por tipo (máx. 5 consultas, nunca una
// por renglón) porque el Kardex ya viene acotado a 200 filas.
async function resolverDocumentosKardex(filas) {
  const idsPorTipo = new Map();
  for (const f of filas) {
    if (!idsPorTipo.has(f.referenciaTipo)) idsPorTipo.set(f.referenciaTipo, new Set());
    idsPorTipo.get(f.referenciaTipo).add(f.referenciaId);
  }

  const folioPorClave = new Map();
  const consultas = [
    ['Venta', prisma.venta],
    ['Compra', prisma.compra],
    ['Ajuste', prisma.ajuste],
    ['Transferencia', prisma.transferencia],
    ['Devolucion', prisma.devolucion],
  ];
  await Promise.all(consultas.map(async ([tipoRef, modelo]) => {
    const ids = idsPorTipo.get(tipoRef);
    if (!ids?.size) return;
    const filas2 = await modelo.findMany({ where: { id: { in: [...ids] } }, select: { id: true, folio: true } });
    filas2.forEach((r) => folioPorClave.set(`${tipoRef}:${r.id}`, r.folio));
  }));

  return filas.map((f) => ({
    ...f,
    documento: folioPorClave.get(`${f.referenciaTipo}:${f.referenciaId}`)
      || ETIQUETA_SIN_FOLIO[f.referenciaTipo]
      || f.referenciaTipo,
  }));
}

// Requerimiento #8 (Kardex por artículo). Saldo corrido calculado con una función de ventana SQL
// en vez de guardarlo en MovimientoInventario al escribir -- así no hace falta migrar ni
// recalcular el histórico (la alternativa evaluada en la auditoría original). La ventana corre
// sobre TODO el historial del artículo (sin filtro de fecha) para que "Existencia" en cada
// renglón sea el saldo real a esa fecha; el filtro de fecha se aplica después, sobre el
// resultado ya acumulado, para no arrancar la cuenta en cero a mitad de la historia.
// "Costo" usa el costo ACTUAL del artículo (Articulo.costo), no uno histórico por movimiento --
// mismo criterio ya usado en reporteInventarioValorizado, documentado en la UI.
async function reporteKardex({
  empresaId, articuloId, sucursalId, desde, hasta,
}) {
  if (!articuloId) throw new AppError(400, 'Debes indicar un artículo para ver su Kardex.');

  const articulo = await prisma.articulo.findFirst({
    where: { id: articuloId, empresaId },
    select: {
      id: true, nombre: true, sku: true, costo: true,
    },
  });
  if (!articulo) throw new AppError(404, 'Artículo no encontrado.');

  const condicionesBase = [Prisma.sql`empresa_id = ${empresaId}`, Prisma.sql`articulo_id = ${articuloId}`];
  if (sucursalId) condicionesBase.push(Prisma.sql`sucursal_id = ${sucursalId}`);
  const whereBase = Prisma.join(condicionesBase, ' AND ');

  const condicionesFecha = [Prisma.sql`1=1`];
  if (desde) condicionesFecha.push(Prisma.sql`"creadoEn" >= ${new Date(desde)}`);
  if (hasta) condicionesFecha.push(Prisma.sql`"creadoEn" <= ${new Date(hasta)}`);
  const whereFecha = Prisma.join(condicionesFecha, ' AND ');

  const entradaTipos = Prisma.join(TIPOS_ENTRADA.map((t) => Prisma.sql`${t}`), ', ');

  const filasRaw = await prisma.$queryRaw`
    WITH movimientos AS (
      SELECT
        id,
        creado_en AS "creadoEn",
        tipo,
        referencia_tipo AS "referenciaTipo",
        referencia_id AS "referenciaId",
        cantidad,
        SUM(CASE WHEN tipo::text IN (${entradaTipos}) THEN cantidad ELSE -cantidad END)
          OVER (ORDER BY creado_en, id) AS existencia
      FROM movimientos_inventario
      WHERE ${whereBase}
    )
    SELECT * FROM movimientos
    WHERE ${whereFecha}
    ORDER BY "creadoEn" DESC, id DESC
    LIMIT 200
  `;

  const filas = filasRaw.map((f) => {
    const cantidad = Number(f.cantidad);
    const esEntrada = TIPOS_ENTRADA.includes(f.tipo);
    return {
      id: f.id,
      creadoEn: f.creadoEn,
      tipo: f.tipo,
      referenciaTipo: f.referenciaTipo,
      referenciaId: f.referenciaId,
      entrada: esEntrada ? cantidad : 0,
      salida: esEntrada ? 0 : cantidad,
      existencia: Number(f.existencia),
      costo: Number(articulo.costo),
    };
  });

  const movimientos = await resolverDocumentosKardex(filas);

  return { articulo, movimientos };
}

async function reporteVentas({
  empresaId, sucursalId, desde, hasta, usuarioId, clienteId,
}) {
  const where = { empresaId, estado: 'CONFIRMADA' };
  if (sucursalId) where.sucursalId = sucursalId;
  if (usuarioId) where.usuarioId = usuarioId;
  if (clienteId) where.clienteId = clienteId;
  if (desde || hasta) {
    where.creadoEn = {};
    if (desde) where.creadoEn.gte = new Date(desde);
    if (hasta) where.creadoEn.lte = new Date(hasta);
  }

  const [resumen, ventas] = await Promise.all([
    prisma.venta.aggregate({
      where,
      _sum: { subtotal: true, impuestos: true, total: true },
      _count: { _all: true },
      _avg: { total: true },
    }),
    prisma.venta.findMany({ where, select: { id: true } }),
  ]);

  const ventaIds = ventas.map((v) => v.id);
  // Una devolución no cambia venta.estado ni sus totales guardados (queda CONFIRMADA con el
  // monto original) -- sin esto, "total" sobreestima el ingreso neto en cuanto hay una
  // devolución. Se suman los reembolsos de las devoluciones de estas mismas ventas (sin
  // importar cuándo se procesó la devolución) para exponer también la cifra neta.
  const [pagosPorMetodo, devolucionesAgg] = await Promise.all([
    ventaIds.length
      ? prisma.pago.groupBy({ by: ['metodo'], where: { ventaId: { in: ventaIds } }, _sum: { monto: true } })
      : [],
    ventaIds.length
      ? prisma.devolucion.aggregate({ where: { ventaId: { in: ventaIds } }, _sum: { reembolso: true } })
      : { _sum: { reembolso: null } },
  ]);

  const total = Number(resumen._sum.total || 0);
  const totalDevoluciones = Number(devolucionesAgg._sum.reembolso || 0);

  return {
    numeroVentas: resumen._count._all,
    subtotal: resumen._sum.subtotal || 0,
    impuestos: resumen._sum.impuestos || 0,
    total: resumen._sum.total || 0,
    totalDevoluciones,
    totalNeto: redondear(total - totalDevoluciones),
    ticketPromedio: resumen._avg.total || 0,
    porMetodoPago: pagosPorMetodo.map((p) => ({ metodo: p.metodo, monto: p._sum.monto })),
  };
}

// VentaDetalle no permite sumar cantidad × precio con groupBy de Prisma (solo suma columnas,
// no productos) — se traen las filas y se reduce en JS, escala pensada para una PyME.
async function reporteArticulosMasVendidos({
  empresaId, sucursalId, desde, hasta, limite = 10, usuarioId, clienteId, categoriaId, tipo,
}) {
  const whereVenta = { empresaId, estado: 'CONFIRMADA' };
  if (sucursalId) whereVenta.sucursalId = sucursalId;
  if (usuarioId) whereVenta.usuarioId = usuarioId;
  if (clienteId) whereVenta.clienteId = clienteId;
  if (desde || hasta) {
    whereVenta.creadoEn = {};
    if (desde) whereVenta.creadoEn.gte = new Date(desde);
    if (hasta) whereVenta.creadoEn.lte = new Date(hasta);
  }

  const ventas = await prisma.venta.findMany({ where: whereVenta, select: { id: true } });
  const ventaIds = ventas.map((v) => v.id);
  if (!ventaIds.length) return [];

  const detalles = await prisma.ventaDetalle.findMany({
    where: { ventaId: { in: ventaIds } },
    select: {
      articuloId: true, cantidad: true, precio: true, cantidadDevuelta: true, descuentoMonto: true, costoUnitario: true,
    },
  });

  // Se descuenta lo devuelto de cada línea -- si no, un artículo devuelto por completo seguiría
  // apareciendo como "vendido" aquí (mismo hueco que en reporteVentas#total). También se
  // prorratea descuentoMonto por unidad (mismo criterio que el reembolso de devoluciones.service.js)
  // -- sin esto, "monto" mostraba el precio de lista en vez de lo que el cliente realmente pagó
  // cuando la línea tuvo un descuento/promoción de catálogo.
  const acumulado = new Map();
  for (const d of detalles) {
    const cantidadOriginal = Number(d.cantidad);
    const cantidadNeta = cantidadOriginal - Number(d.cantidadDevuelta);
    const descuentoPorUnidad = cantidadOriginal > 0 ? Number(d.descuentoMonto) / cantidadOriginal : 0;
    const precioNetoUnitario = Number(d.precio) - descuentoPorUnidad;
    const actual = acumulado.get(d.articuloId) || {
      cantidad: 0, monto: 0, costoTotal: 0, costoCompleto: true,
    };
    actual.cantidad += cantidadNeta;
    actual.monto += cantidadNeta * precioNetoUnitario;
    // costoUnitario es null en ventas de antes de que este campo existiera (ver comentario en
    // schema.prisma) -- una sola línea sin costo invalida la "Utilidad" del artículo entero (no
    // se puede promediar ni aproximar sin mentir), así que se marca costoCompleto:false en vez
    // de tratarlo como 0.
    if (d.costoUnitario !== null) {
      actual.costoTotal += cantidadNeta * Number(d.costoUnitario);
    } else {
      actual.costoCompleto = false;
    }
    acumulado.set(d.articuloId, actual);
  }

  const articuloIds = [...acumulado.keys()];
  const articulos = await prisma.articulo.findMany({
    where: { id: { in: articuloIds } },
    select: {
      id: true, nombre: true, sku: true, categoriaId: true, tipo: true,
    },
  });
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  let filas = [...acumulado.entries()]
    .map(([articuloId, datos]) => ({
      articulo: articuloPorId.get(articuloId) || null,
      cantidad: datos.cantidad,
      monto: datos.monto,
      utilidad: datos.costoCompleto ? redondear(datos.monto - datos.costoTotal) : null,
    }));
  // Filtrado en JS igual que el resto de esta función (comentario de arriba): el volumen de
  // artículos distintos vendidos en un rango es chico para una PyME, no justifica una segunda
  // consulta a la DB solo para acotar por categoría/tipo.
  if (categoriaId) {
    filas = filas.filter((f) => f.articulo?.categoriaId === categoriaId);
  }
  if (tipo) {
    filas = filas.filter((f) => f.articulo?.tipo === tipo);
  }

  return filas
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, limite);
}

// Requerimiento #12 (Utilidad de ventas): mismo alcance que reporteVentas (Fecha, Sucursal), a
// diferencia de reporteArticulosMasVendidos que agrupa por artículo -- acá se suma todo junto.
// Depende de VentaDetalle.costoUnitario (ver schema.prisma): las ventas de antes de que ese
// campo existiera no tienen costo congelado, así que "ganancia" se calcula solo sobre las
// líneas que sí lo tienen (nunca aproximando con 0 o el costo de hoy) y se expone
// `lineasSinCosto` para que la UI avise cuando el número es parcial.
async function reporteUtilidad({
  empresaId, sucursalId, desde, hasta,
}) {
  const whereVenta = { empresaId, estado: 'CONFIRMADA' };
  if (sucursalId) whereVenta.sucursalId = sucursalId;
  if (desde || hasta) {
    whereVenta.creadoEn = {};
    if (desde) whereVenta.creadoEn.gte = new Date(desde);
    if (hasta) whereVenta.creadoEn.lte = new Date(hasta);
  }

  const ventas = await prisma.venta.findMany({ where: whereVenta, select: { id: true } });
  const ventaIds = ventas.map((v) => v.id);
  if (!ventaIds.length) {
    return {
      venta: 0, costo: 0, ganancia: 0, lineasTotales: 0, lineasSinCosto: 0,
    };
  }

  const detalles = await prisma.ventaDetalle.findMany({
    where: { ventaId: { in: ventaIds } },
    select: {
      cantidad: true, precio: true, cantidadDevuelta: true, descuentoMonto: true, costoUnitario: true,
    },
  });

  let ventaTotal = 0;
  let ventaConCosto = 0;
  let costoTotal = 0;
  let lineasSinCosto = 0;
  for (const d of detalles) {
    const cantidadOriginal = Number(d.cantidad);
    const cantidadNeta = cantidadOriginal - Number(d.cantidadDevuelta);
    const descuentoPorUnidad = cantidadOriginal > 0 ? Number(d.descuentoMonto) / cantidadOriginal : 0;
    const precioNetoUnitario = Number(d.precio) - descuentoPorUnidad;
    const montoLinea = cantidadNeta * precioNetoUnitario;
    ventaTotal += montoLinea;
    if (d.costoUnitario !== null) {
      ventaConCosto += montoLinea;
      costoTotal += cantidadNeta * Number(d.costoUnitario);
    } else {
      lineasSinCosto += 1;
    }
  }

  return {
    venta: redondear(ventaTotal),
    costo: redondear(costoTotal),
    ganancia: redondear(ventaConCosto - costoTotal),
    lineasTotales: detalles.length,
    lineasSinCosto,
  };
}

// Filtros: Fecha, Sucursal (mismo alcance que reporteVentas). A diferencia de
// reporteArticulosMasVendidos, acá sí alcanza un groupBy de Prisma (es una suma simple de
// Venta.total, no un producto cantidad×precio por línea).
async function reporteVentasPorCliente({
  empresaId, sucursalId, desde, hasta,
}) {
  const where = { empresaId, estado: 'CONFIRMADA' };
  if (sucursalId) where.sucursalId = sucursalId;
  if (desde || hasta) {
    where.creadoEn = {};
    if (desde) where.creadoEn.gte = new Date(desde);
    if (hasta) where.creadoEn.lte = new Date(hasta);
  }

  const ventas = await prisma.venta.findMany({ where, select: { id: true, clienteId: true, total: true } });
  if (!ventas.length) return [];

  const ventaIds = ventas.map((v) => v.id);
  const clientePorVentaId = new Map(ventas.map((v) => [v.id, v.clienteId]));

  // Mismo criterio que reporteVentas#totalNeto: una devolución no cambia Venta.total, así que se
  // resta el reembolso aparte para no sobreestimar lo que un cliente realmente pagó.
  const devoluciones = await prisma.devolucion.findMany({
    where: { ventaId: { in: ventaIds } },
    select: { ventaId: true, reembolso: true },
  });

  const acumulado = new Map();
  for (const v of ventas) {
    const actual = acumulado.get(v.clienteId) || { numeroVentas: 0, total: 0, totalDevoluciones: 0 };
    actual.numeroVentas += 1;
    actual.total += Number(v.total);
    acumulado.set(v.clienteId, actual);
  }
  for (const d of devoluciones) {
    const clienteId = clientePorVentaId.get(d.ventaId);
    const actual = acumulado.get(clienteId);
    if (actual) actual.totalDevoluciones += Number(d.reembolso);
  }

  const clientes = await prisma.cliente.findMany({
    where: { id: { in: [...acumulado.keys()] } },
    select: { id: true, nombre: true },
  });
  const clientePorId = new Map(clientes.map((c) => [c.id, c]));

  return [...acumulado.entries()]
    .map(([clienteId, datos]) => ({
      cliente: clientePorId.get(clienteId) || null,
      numeroVentas: datos.numeroVentas,
      total: datos.total,
      totalDevoluciones: datos.totalDevoluciones,
      totalNeto: redondear(datos.total - datos.totalDevoluciones),
    }))
    .sort((a, b) => b.totalNeto - a.totalNeto);
}

// Requerimiento #13 (IVA trasladado): Filtros Fecha, Cliente (sin Sucursal -- no lo pide la
// especificación). Agrupa por impuestoTasa en vez de por artículo/cliente -- mismo patrón de
// "traer detalles y reducir en JS" que reporteArticulosMasVendidos, pero la clave de
// agrupación es la tasa congelada de cada línea (VentaDetalle.impuestoTasa), no el articuloId.
async function reporteIvaTrasladado({
  empresaId, desde, hasta, clienteId,
}) {
  const whereVenta = { empresaId, estado: 'CONFIRMADA' };
  if (clienteId) whereVenta.clienteId = clienteId;
  if (desde || hasta) {
    whereVenta.creadoEn = {};
    if (desde) whereVenta.creadoEn.gte = new Date(desde);
    if (hasta) whereVenta.creadoEn.lte = new Date(hasta);
  }

  const ventas = await prisma.venta.findMany({ where: whereVenta, select: { id: true } });
  const ventaIds = ventas.map((v) => v.id);
  if (!ventaIds.length) return { porTasa: [], baseGravable: 0, impuesto: 0 };

  const detalles = await prisma.ventaDetalle.findMany({
    where: { ventaId: { in: ventaIds } },
    select: {
      cantidad: true, precio: true, cantidadDevuelta: true, descuentoMonto: true, impuestoTasa: true,
    },
  });

  // Misma base gravable "neta" que el resto de los reportes de ventas: descuenta lo devuelto y
  // prorratea el descuento por unidad, para no trasladar IVA sobre algo que ya se devolvió o
  // que el cliente nunca pagó por el descuento.
  const acumulado = new Map();
  for (const d of detalles) {
    const cantidadOriginal = Number(d.cantidad);
    const cantidadNeta = cantidadOriginal - Number(d.cantidadDevuelta);
    const descuentoPorUnidad = cantidadOriginal > 0 ? Number(d.descuentoMonto) / cantidadOriginal : 0;
    const baseLinea = cantidadNeta * (Number(d.precio) - descuentoPorUnidad);
    const tasa = Number(d.impuestoTasa);
    const actual = acumulado.get(tasa) || { baseGravable: 0, impuesto: 0 };
    actual.baseGravable += baseLinea;
    actual.impuesto += baseLinea * tasa;
    acumulado.set(tasa, actual);
  }

  const porTasa = [...acumulado.entries()]
    .map(([tasa, datos]) => ({
      tasa, baseGravable: redondear(datos.baseGravable), impuesto: redondear(datos.impuesto),
    }))
    .sort((a, b) => a.tasa - b.tasa);

  return {
    porTasa,
    baseGravable: redondear(porTasa.reduce((acc, p) => acc + p.baseGravable, 0)),
    impuesto: redondear(porTasa.reduce((acc, p) => acc + p.impuesto, 0)),
  };
}

// "Nunca tuvo movimiento" cuenta igual que "hace más de `dias`" -- ambos son candidatos a
// revisar. Excluye Servicio/Kit a propósito: nunca generan MovimientoInventario (ver "Un
// artículo tipo Servicio ya no genera movimiento de stock" más abajo en este README), así que
// listarlos acá siempre los mostraría como "sin movimiento" sin que signifique nada.
async function reporteProductosSinMovimiento({ empresaId, dias = 30, categoriaId }) {
  const where = {
    empresaId, activo: true, tipo: 'PRODUCTO',
  };
  if (categoriaId) where.categoriaId = categoriaId;

  const articulos = await prisma.articulo.findMany({
    where,
    select: {
      id: true, nombre: true, sku: true, categoriaId: true,
    },
  });
  if (!articulos.length) return [];

  const ultimos = await prisma.movimientoInventario.groupBy({
    by: ['articuloId'],
    where: { empresaId, articuloId: { in: articulos.map((a) => a.id) } },
    _max: { creadoEn: true },
  });
  const ultimoPorArticulo = new Map(ultimos.map((u) => [u.articuloId, u._max.creadoEn]));

  const limite = new Date();
  limite.setDate(limite.getDate() - Number(dias));

  return articulos
    .map((articulo) => ({ articulo, ultimoMovimiento: ultimoPorArticulo.get(articulo.id) || null }))
    .filter((f) => !f.ultimoMovimiento || f.ultimoMovimiento < limite)
    .sort((a, b) => {
      if (!a.ultimoMovimiento) return -1;
      if (!b.ultimoMovimiento) return 1;
      return a.ultimoMovimiento - b.ultimoMovimiento;
    });
}

async function reporteInventarioValorizado({ empresaId, sucursalId }) {
  const where = { empresaId };
  if (sucursalId) where.sucursalId = sucursalId;

  const existencias = await prisma.existencia.findMany({
    where,
    include: {
      articulo: { select: { id: true, nombre: true, sku: true, costo: true, stockMinimo: true } },
      sucursal: { select: { id: true, nombre: true } },
    },
  });

  let valorTotal = 0;
  const porSucursal = new Map();
  const stockBajo = [];

  for (const e of existencias) {
    const valor = Number(e.cantidad) * Number(e.articulo.costo);
    valorTotal += valor;

    const actual = porSucursal.get(e.sucursalId) || { sucursal: e.sucursal, valor: 0 };
    actual.valor += valor;
    porSucursal.set(e.sucursalId, actual);

    if (e.articulo.stockMinimo !== null && Number(e.cantidad) <= Number(e.articulo.stockMinimo)) {
      stockBajo.push({
        articulo: e.articulo,
        sucursal: e.sucursal,
        cantidad: e.cantidad,
        stockMinimo: e.articulo.stockMinimo,
      });
    }
  }

  return { valorTotal, porSucursal: [...porSucursal.values()], stockBajo };
}

async function reporteCompras({ empresaId, sucursalId, desde, hasta }) {
  const where = { empresaId, estado: 'CONFIRMADA' };
  if (sucursalId) where.sucursalId = sucursalId;
  if (desde || hasta) {
    where.creadoEn = {};
    if (desde) where.creadoEn.gte = new Date(desde);
    if (hasta) where.creadoEn.lte = new Date(hasta);
  }

  const compras = await prisma.compra.findMany({
    where,
    include: { proveedor: { select: { id: true, nombre: true } } },
  });

  const porProveedor = new Map();
  let total = 0;
  for (const c of compras) {
    total += Number(c.total);
    const actual = porProveedor.get(c.proveedorId) || { proveedor: c.proveedor, total: 0, numeroCompras: 0 };
    actual.total += Number(c.total);
    actual.numeroCompras += 1;
    porProveedor.set(c.proveedorId, actual);
  }

  return { total, numeroCompras: compras.length, porProveedor: [...porProveedor.values()] };
}

// SesionCaja no tiene empresaId propio — se acota vía las Caja de la empresa (mismo patrón
// que Fase 6/7).
async function reporteCaja({
  empresaId, cajaId, desde, hasta, usuarioId,
}) {
  const cajasEmpresa = await prisma.caja.findMany({
    where: { empresaId, ...(cajaId ? { id: cajaId } : {}) },
    select: { id: true, nombre: true },
  });
  const cajaIds = cajasEmpresa.map((c) => c.id);
  const cajaPorId = new Map(cajasEmpresa.map((c) => [c.id, c]));

  const where = { cajaId: { in: cajaIds }, cerradaEn: { not: null } };
  if (usuarioId) where.usuarioResponsableId = usuarioId;
  if (desde) where.cerradaEn.gte = new Date(desde);
  if (hasta) where.cerradaEn.lte = new Date(hasta);

  // El listado de sesiones se limita a 200 (mismo criterio documentado que reporteKardex), pero
  // totalDiferencias es un total de conciliación -- calcularlo sobre las mismas 200 sesiones
  // truncadas lo hacía verse completo sin serlo en una empresa con más de 200 cierres en el
  // rango (encontrado en la ronda de QA pre-lanzamiento). Se agrega aparte, sobre TODO el `where`
  // sin el take, para que el total sea exacto aunque el listado se muestre truncado.
  const [sesiones, agregadoDiferencias] = await Promise.all([
    prisma.sesionCaja.findMany({ where, orderBy: { cerradaEn: 'desc' }, take: 200 }),
    prisma.sesionCaja.aggregate({ where, _sum: { diferencia: true } }),
  ]);
  const totalDiferencias = Number(agregadoDiferencias._sum.diferencia || 0);

  const sesionIds = sesiones.map((s) => s.id);
  const usuarioIds = [...new Set(sesiones.map((s) => s.usuarioResponsableId))];
  // Desglose de Ingreso/Venta/Retiro/Devolución por sesión: ese detalle ya existía en
  // MovimientoCaja (mismo enum TipoMovimientoCaja que usa el cierre de sesión), pero este
  // reporte solo exponía el snapshot final (fondo/esperado/real/diferencia).
  const [movimientosPorTipo, usuarios] = await Promise.all([
    sesionIds.length
      ? prisma.movimientoCaja.groupBy({
        by: ['sesionCajaId', 'tipo'],
        where: { sesionCajaId: { in: sesionIds } },
        _sum: { monto: true },
      })
      : [],
    usuarioIds.length
      ? prisma.usuario.findMany({ where: { id: { in: usuarioIds } }, select: { id: true, nombre: true } })
      : [],
  ]);
  const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));

  const desglosePorSesion = new Map();
  for (const m of movimientosPorTipo) {
    const actual = desglosePorSesion.get(m.sesionCajaId) || {
      ingreso: 0, venta: 0, retiro: 0, devolucion: 0,
    };
    actual[m.tipo.toLowerCase()] = Number(m._sum.monto || 0);
    desglosePorSesion.set(m.sesionCajaId, actual);
  }

  return {
    sesiones: sesiones.map((s) => ({
      ...s,
      caja: cajaPorId.get(s.cajaId) || null,
      cajero: usuarioPorId.get(s.usuarioResponsableId) || null,
      movimientos: desglosePorSesion.get(s.id) || {
        ingreso: 0, venta: 0, retiro: 0, devolucion: 0,
      },
    })),
    totalDiferencias,
  };
}

// A diferencia de cotizaciones/compras/ventas, un reporte no es una fila persistida — no hay
// nada que buscar por ID. El CSV ya viene armado desde el frontend (mismos filas/columnas que
// la tabla en pantalla, ver ReportesPage.jsx), acá solo se relaya por correo y se audita.
async function enviar({
  empresaId, usuarioId, destinatario, asunto, mensaje, adjuntoBase64, nombreArchivo,
}) {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
  const asuntoFinal = asunto || `Reporte — ${empresa?.nombreComercial || 'BOX POS'}`;

  await enviarCorreoConAdjunto({
    destinatario,
    asunto: asuntoFinal,
    mensaje,
    adjunto: { nombreArchivo, contenidoBase64: adjuntoBase64 },
  });

  await registrarAuditoria(null, {
    empresaId,
    usuarioEjecutorId: usuarioId,
    accion: 'ENVIAR_CORREO',
    entidad: 'Reporte',
    entidadId: null,
    valoresDespues: toJson({ destinatario, nombreArchivo }),
  });

  return { enviado: true };
}

module.exports = {
  reporteVentas,
  reporteArticulosMasVendidos,
  reporteUtilidad,
  reporteVentasPorCliente,
  reporteIvaTrasladado,
  reporteKardex,
  reporteProductosSinMovimiento,
  reporteInventarioValorizado,
  reporteCompras,
  reporteCaja,
  enviar,
};
