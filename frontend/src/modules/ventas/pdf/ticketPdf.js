import { jsPDF } from 'jspdf';
import { formatoMoneda, formatoFecha } from '../../../shared/format';

const ANCHO = 80; // mm — mismo ancho que el recibo térmico impreso (TicketVenta.jsx)
const MARGEN_X = 4;
const DERECHA = ANCHO - MARGEN_X;
const METODO_LABEL = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia' };

// El ticket solo existe hoy como impresión térmica (TicketVenta.jsx + window.print()) — esta es
// una ruta paralela que arma el mismo contenido como PDF, únicamente para poder adjuntarlo a un
// correo. No reemplaza la impresión existente.
//
// jsPDF necesita una altura de página fija: se estima a partir de la cantidad de líneas/renglones
// que va a ocupar el contenido (mismo criterio de alto variable que ya tiene el recibo impreso,
// que crece con la cantidad de líneas de la venta).
function estimarAlto(venta) {
  const lineasDetalle = (venta.detalles || []).reduce(
    (acc, d) => acc + (Number(d.descuentoMonto || 0) > 0 ? 2 : 1.4), 0,
  );
  const lineasPagos = (venta.pagos || []).length;
  return 60 + lineasDetalle * 7 + lineasPagos * 4 + 20;
}

function construirDocTicket(venta, empresa, cambio) {
  const doc = new jsPDF({ unit: 'mm', format: [ANCHO, estimarAlto(venta)] });
  let y = 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text(empresa?.nombreComercial || '', ANCHO / 2, y, { align: 'center' });
  doc.setFont(undefined, 'normal');
  doc.setFontSize(7.5);
  y += 4;
  if (empresa?.rfc) { doc.text(`RFC: ${empresa.rfc}`, ANCHO / 2, y, { align: 'center' }); y += 3.5; }
  if (empresa?.telefono) { doc.text(`Tel: ${empresa.telefono}`, ANCHO / 2, y, { align: 'center' }); y += 3.5; }
  if (venta.sucursal?.nombre) { doc.text(venta.sucursal.nombre, ANCHO / 2, y, { align: 'center' }); y += 3.5; }
  if (venta.sucursal?.direccion) { doc.text(venta.sucursal.direccion, ANCHO / 2, y, { align: 'center' }); y += 3.5; }

  y += 2;
  doc.setDrawColor(150);
  doc.line(MARGEN_X, y, DERECHA, y);
  y += 4;

  doc.text(`Folio: ${venta.folio}`, MARGEN_X, y); y += 3.5;
  doc.text(`Fecha: ${formatoFecha(venta.creadoEn)}`, MARGEN_X, y); y += 3.5;
  if (venta.cliente?.nombre) { doc.text(`Cliente: ${venta.cliente.nombre}`, MARGEN_X, y); y += 3.5; }
  if (venta.estado === 'CANCELADA') {
    doc.setFont(undefined, 'bold');
    doc.text('** VENTA CANCELADA **', ANCHO / 2, y, { align: 'center' });
    doc.setFont(undefined, 'normal');
    y += 3.5;
  }

  y += 1;
  doc.line(MARGEN_X, y, DERECHA, y);
  y += 4;

  (venta.detalles || []).forEach((d) => {
    const cantidad = Number(d.cantidad);
    const precio = Number(d.precio);
    const descuentoMonto = Number(d.descuentoMonto || 0);
    const importe = cantidad * precio - descuentoMonto;
    doc.text(d.articulo?.nombre || d.articuloId, MARGEN_X, y, { maxWidth: ANCHO - MARGEN_X * 2 });
    y += 3.5;
    doc.text(`${cantidad} x ${formatoMoneda(precio)}`, MARGEN_X, y);
    doc.text(formatoMoneda(importe), DERECHA, y, { align: 'right' });
    y += 3.5;
    if (descuentoMonto > 0) {
      const nombreDescuento = d.descuento?.nombre || d.promocion?.nombre
        || d.descuentoNombre || d.promocionNombre || 'Descuento manual';
      doc.setFontSize(6.5);
      doc.text(nombreDescuento === 'Descuento manual' ? nombreDescuento : `Descuento: ${nombreDescuento}`, MARGEN_X, y);
      doc.text(`-${formatoMoneda(descuentoMonto)}`, DERECHA, y, { align: 'right' });
      doc.setFontSize(7.5);
      y += 3.5;
    }
  });

  y += 1;
  doc.line(MARGEN_X, y, DERECHA, y);
  y += 4;

  const descuentoTotal = (venta.detalles || []).reduce((acc, d) => acc + Number(d.descuentoMonto || 0), 0);
  if (descuentoTotal > 0) {
    doc.text('Descuento', MARGEN_X, y);
    doc.text(`-${formatoMoneda(descuentoTotal)}`, DERECHA, y, { align: 'right' });
    y += 3.5;
  }
  doc.text('Subtotal', MARGEN_X, y);
  doc.text(formatoMoneda(venta.subtotal), DERECHA, y, { align: 'right' });
  y += 3.5;
  doc.text('Impuestos', MARGEN_X, y);
  doc.text(formatoMoneda(venta.impuestos), DERECHA, y, { align: 'right' });
  y += 4;
  doc.setFont(undefined, 'bold');
  doc.setFontSize(9);
  doc.text('Total', MARGEN_X, y);
  doc.text(formatoMoneda(venta.total), DERECHA, y, { align: 'right' });
  doc.setFont(undefined, 'normal');
  doc.setFontSize(7.5);
  y += 5;

  doc.line(MARGEN_X, y, DERECHA, y);
  y += 4;

  (venta.pagos || []).forEach((p) => {
    doc.text(METODO_LABEL[p.metodo] || p.metodo, MARGEN_X, y);
    doc.text(formatoMoneda(p.monto), DERECHA, y, { align: 'right' });
    y += 3.5;
  });
  if (cambio > 0) {
    doc.setFont(undefined, 'bold');
    doc.text('Cambio', MARGEN_X, y);
    doc.text(formatoMoneda(cambio), DERECHA, y, { align: 'right' });
    doc.setFont(undefined, 'normal');
    y += 3.5;
  }

  y += 4;
  doc.text('¡Gracias por su compra!', ANCHO / 2, y, { align: 'center' });

  return doc;
}

export function generarBase64Ticket(venta, empresa, cambio) {
  const doc = construirDocTicket(venta, empresa, cambio);
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',')[1];
  const nombreArchivo = `ticket-${venta.folio || 'venta'}.pdf`;
  return { base64, nombreArchivo };
}
