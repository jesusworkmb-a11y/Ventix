const AppError = require('../errors/AppError');

const DIRECCION_POR_TIPO = {
  ENTRADA_COMPRA: 1,
  SALIDA_VENTA: -1,
  ENTRADA_DEVOLUCION: 1,
  AJUSTE_ENTRADA: 1,
  AJUSTE_SALIDA: -1,
  INVENTARIO_INICIAL: 1,
  TRANSFERENCIA_SALIDA: -1,
  TRANSFERENCIA_ENTRADA: 1,
  CANCELACION_COMPRA: -1,
  CANCELACION_VENTA: 1,
};

// Único punto de escritura de stock en todo el proyecto. SIEMPRE se llama con el tx de la
// transacción del documento que origina el movimiento (Ajuste, Transferencia, y más adelante
// Compra/Venta) — Existencia y el Kardex se confirman o fallan juntos.
async function aplicarMovimiento(tx, { empresaId, sucursalId, articuloId, tipo, cantidad, referenciaTipo, referenciaId, usuarioId }) {
  // Un artículo tipo SERVICIO no lleva inventario (no se guarda en almacén) — se omite a
  // propósito, no es un error: el documento que originó el movimiento (Compra/Venta/Devolución/
  // etc.) sigue su curso normal, solo que sin tocar Existencia/Kardex. Único punto de escritura
  // de stock del proyecto, así que basta chequearlo acá para cubrir a todos los llamadores.
  const articulo = await tx.articulo.findUnique({ where: { id: articuloId }, select: { tipo: true } });
  if (articulo?.tipo === 'SERVICIO') {
    return { existencia: null, movimiento: null, omitido: true };
  }

  // Un artículo tipo KIT tampoco lleva Existencia propia — no se "arma" por adelantado (ver
  // decisión de diseño), se descompone en sus componentes en el momento del movimiento: vender
  // 1 kit descuenta cantidad×factor de cada componente, cancelar/devolver lo revierte igual,
  // porque este es el único punto de escritura de stock y todos los llamadores (Ventas,
  // Devoluciones, Compras) ya recorren sus líneas pasando por acá sin saber si es un kit.
  if (articulo?.tipo === 'KIT') {
    const componentes = await tx.articuloKitDetalle.findMany({ where: { kitId: articuloId } });
    const resultados = [];
    for (const componente of componentes) {
      const resultado = await aplicarMovimiento(tx, {
        empresaId,
        sucursalId,
        articuloId: componente.articuloComponenteId,
        tipo,
        cantidad: cantidad * Number(componente.cantidad),
        referenciaTipo,
        referenciaId,
        usuarioId,
      });
      resultados.push(resultado);
    }
    return { existencia: null, movimiento: null, kit: true, componentes: resultados };
  }

  const delta = cantidad * DIRECCION_POR_TIPO[tipo];

  const existencia = await tx.existencia.upsert({
    where: { sucursalId_articuloId: { sucursalId, articuloId } },
    create: { empresaId, sucursalId, articuloId, cantidad: delta },
    update: { cantidad: { increment: delta } },
  });

  if (Number(existencia.cantidad) < 0) {
    throw new AppError(409, 'No hay existencia suficiente para esta operación.');
  }

  const movimiento = await tx.movimientoInventario.create({
    data: { empresaId, sucursalId, articuloId, tipo, cantidad, referenciaTipo, referenciaId, usuarioId },
  });

  return { existencia, movimiento };
}

module.exports = { aplicarMovimiento };
