import { guardarDocumento, base64Documento } from '../../../shared/pdf/motor';

const TONO_ESTADO = { CONFIRMADA: 'exito', CANCELADA: 'peligro' };
const TEXTO_ESTADO = { CONFIRMADA: 'Confirmada', CANCELADA: 'Cancelada' };

// A diferencia del ticket térmico (TicketVenta.jsx / ticketPdf.js, pensado para la caja física o
// para adjuntar a un correo), este es el comprobante completo con el motor de 6 plantillas —
// mismo patrón que compraPdf.js: Venta ya persiste subtotal/impuestos/total, se usan tal cual sin
// recalcular (a diferencia de Cotización, que sí recalcula desde las líneas).
function construirDatos(venta, empresa) {
  const conceptos = venta.detalles.map((d) => {
    const cantidad = Number(d.cantidad);
    const precio = Number(d.precio);
    const descuentoMonto = Number(d.descuentoMonto || 0);
    const tasa = Number(d.impuestoTasa || 0);
    return {
      codigo: d.articulo?.sku || '—',
      descripcion: d.articulo?.nombre || d.articuloId,
      cantidad,
      unidad: d.articulo?.unidadBase?.abreviatura || d.articulo?.unidadBase?.nombre || null,
      precioUnitario: precio,
      descuento: descuentoMonto,
      impuestoTexto: tasa > 0 ? `${Math.round(tasa * 100)}%` : '—',
      importe: cantidad * precio - descuentoMonto,
      imagenUrl: d.articulo?.imagenUrl || null,
    };
  });
  const descuentoTotal = Math.round(conceptos.reduce((acc, l) => acc + l.descuento, 0) * 100) / 100;
  const subtotal = Number(venta.subtotal);
  const impuestos = Number(venta.impuestos);
  const total = Number(venta.total);

  return {
    tipoDocumento: 'VENTA',
    tituloDocumento: 'VENTA',
    folio: venta.folio,
    fecha: venta.creadoEn,
    estatus: venta.estado
      ? { texto: TEXTO_ESTADO[venta.estado] || venta.estado, tono: TONO_ESTADO[venta.estado] || 'neutro' }
      : null,
    empresa: { ...empresa, direccion: venta.sucursal?.direccion || null },
    contraparte: {
      etiqueta: 'Cliente',
      nombre: venta.cliente?.nombre,
      rfc: venta.cliente?.rfc,
      telefono: venta.cliente?.telefono,
      correo: venta.cliente?.correo,
      direccion: venta.cliente?.direccion,
    },
    conceptos,
    resumen: { subtotal, descuentoTotal, impuestos, total },
    piePagina: {},
    extra: { sucursal: venta.sucursal?.nombre },
  };
}

export function generarPdfVenta(venta, empresa) {
  const datos = construirDatos(venta, empresa);
  guardarDocumento(datos, `${venta.folio || 'venta'}.pdf`);
}

// Para el envío por correo, mismo criterio que generarBase64Compra (el backend no genera PDFs).
export function generarBase64Venta(venta, empresa) {
  const datos = construirDatos(venta, empresa);
  return base64Documento(datos, `${venta.folio || 'venta'}.pdf`);
}
