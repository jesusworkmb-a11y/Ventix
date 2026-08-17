import { guardarDocumento, base64Documento } from '../../../shared/pdf/motor';

const TONO_ESTADO = { ENVIADA: 'neutro', PARCIAL: 'advertencia', RECIBIDA: 'exito', CERRADA: 'neutro', CANCELADA: 'peligro' };
const TEXTO_ESTADO = { ENVIADA: 'Enviada', PARCIAL: 'Parcial', RECIBIDA: 'Recibida', CERRADA: 'Cerrada', CANCELADA: 'Cancelada' };

// Sin impuestos ni descuento (a diferencia de compraPdf.js): una orden es una solicitud, no un
// documento fiscal — el costoEstimado es solo referencia para negociar con el proveedor, y
// puede no existir todavía (líneas sin costoEstimado se muestran como "—", no "$0.00").
function construirDatos(orden, empresa) {
  const conceptos = orden.detalles.map((d) => {
    const cantidad = Number(d.cantidad);
    const costoEstimado = d.costoEstimado !== null && d.costoEstimado !== undefined ? Number(d.costoEstimado) : null;
    return {
      codigo: d.articulo?.sku || '—',
      descripcion: d.articulo?.nombre || d.articuloId,
      cantidad,
      unidad: d.unidad?.abreviatura || d.unidad?.nombre || null,
      precioUnitario: costoEstimado,
      descuento: 0,
      impuestoTexto: '—',
      importe: costoEstimado !== null ? cantidad * costoEstimado : null,
      imagenUrl: d.articulo?.imagenUrl || null,
    };
  });
  const hayEstimado = conceptos.some((l) => l.precioUnitario !== null);
  const totalEstimado = hayEstimado
    ? Math.round(conceptos.reduce((acc, l) => acc + (l.importe || 0), 0) * 100) / 100
    : null;

  return {
    tipoDocumento: 'ORDEN_COMPRA',
    tituloDocumento: 'ORDEN DE COMPRA',
    folio: orden.folio,
    fecha: orden.creadoEn,
    estatus: orden.estado
      ? { texto: TEXTO_ESTADO[orden.estado] || orden.estado, tono: TONO_ESTADO[orden.estado] || 'neutro' }
      : null,
    empresa: { ...empresa, direccion: orden.sucursal?.direccion || null },
    contraparte: {
      etiqueta: 'Proveedor',
      nombre: orden.proveedor?.nombre,
      telefono: orden.proveedor?.telefono,
      correo: orden.proveedor?.correo,
      direccion: orden.proveedor?.direccion,
    },
    conceptos,
    resumen: { subtotal: totalEstimado, descuentoTotal: 0, impuestos: hayEstimado ? 0 : null, total: totalEstimado },
    piePagina: { observaciones: orden.observaciones },
    extra: { sucursal: orden.sucursal?.nombre },
  };
}

export function generarPdfOrdenCompra(orden, empresa) {
  const datos = construirDatos(orden, empresa);
  guardarDocumento(datos, `${orden.folio || 'orden-compra'}.pdf`);
}

// Para el envío por correo: el backend no genera PDFs (ver correo.service.js), así que el
// frontend arma el mismo documento y lo manda en base64 crudo (sin el prefijo `data:...;base64,`
// del data URI que devuelve jsPDF).
export function generarBase64OrdenCompra(orden, empresa) {
  const datos = construirDatos(orden, empresa);
  return base64Documento(datos, `${orden.folio || 'orden-compra'}.pdf`);
}
