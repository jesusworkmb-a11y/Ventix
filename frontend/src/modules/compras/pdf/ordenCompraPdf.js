import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatoMoneda, formatoFecha } from '../../../shared/format';

const MARGEN_X = 15;
const ANCHO_PAGINA = 210;
const DERECHA = ANCHO_PAGINA - MARGEN_X;
const ALTO_LOGO = 16; // mm — ancho se deriva de la proporción real de la imagen

// Construye el jsPDF sin ningún efecto lateral (no descarga) — reusado tanto por
// generarPdfOrdenCompra (descarga directa) como por generarBase64OrdenCompra (envío por correo).
// Sin impuestos ni descuento (a diferencia de compraPdf.js): una orden es una solicitud, no un
// documento fiscal — el costoEstimado es solo referencia para negociar con el proveedor.
function construirDocOrdenCompra(orden, empresa) {
  const lineas = orden.detalles.map((d) => {
    const cantidad = Number(d.cantidad);
    const costoEstimado = d.costoEstimado !== null && d.costoEstimado !== undefined ? Number(d.costoEstimado) : null;
    return {
      nombre: d.articulo?.nombre || d.articuloId,
      unidad: d.unidad?.abreviatura || d.unidad?.nombre || '',
      cantidad,
      costoEstimado,
      importeEstimado: costoEstimado !== null ? cantidad * costoEstimado : null,
    };
  });
  const hayEstimado = lineas.some((l) => l.costoEstimado !== null);
  const totalEstimado = hayEstimado
    ? Math.round(lineas.reduce((acc, l) => acc + (l.importeEstimado || 0), 0) * 100) / 100
    : null;

  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  let y = 20;
  let xTexto = MARGEN_X;

  if (empresa?.logoUrl) {
    try {
      const propiedades = doc.getImageProperties(empresa.logoUrl);
      const anchoLogo = (propiedades.width / propiedades.height) * ALTO_LOGO;
      doc.addImage(empresa.logoUrl, 'PNG', MARGEN_X, 10, anchoLogo, ALTO_LOGO);
      xTexto = MARGEN_X + anchoLogo + 4;
    } catch (err) {
      xTexto = MARGEN_X;
    }
  }

  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(empresa?.nombreComercial || '', xTexto, y);

  doc.setFontSize(14);
  doc.text('ORDEN DE COMPRA', DERECHA, y, { align: 'right' });

  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  y += 6;
  const datosEmpresa = [empresa?.rfc && `RFC: ${empresa.rfc}`, empresa?.telefono, empresa?.correo]
    .filter(Boolean).join(' · ');
  if (datosEmpresa) { doc.text(datosEmpresa, xTexto, y); }
  doc.text(`Folio: ${orden.folio || '-'}`, DERECHA, y, { align: 'right' });
  y += 5;
  if (orden.sucursal?.nombre) {
    const sucursalTexto = orden.sucursal.direccion
      ? `${orden.sucursal.nombre} — ${orden.sucursal.direccion}`
      : orden.sucursal.nombre;
    doc.text(sucursalTexto, xTexto, y);
  }
  doc.text(`Fecha: ${formatoFecha(orden.creadoEn)}`, DERECHA, y, { align: 'right' });

  y += 10;
  doc.setDrawColor(210);
  doc.line(MARGEN_X, y, DERECHA, y);
  y += 8;

  doc.setTextColor(30);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.text('Proveedor', MARGEN_X, y);
  y += 5;
  doc.setFont(undefined, 'normal');
  doc.text(orden.proveedor?.nombre || '', MARGEN_X, y);
  y += 5;
  const contacto = [orden.proveedor?.telefono, orden.proveedor?.correo].filter(Boolean).join(' · ');
  if (contacto) { doc.text(contacto, MARGEN_X, y); y += 5; }
  if (orden.proveedor?.direccion) { doc.text(orden.proveedor.direccion, MARGEN_X, y); y += 5; }

  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Artículo', 'Unidad', 'Cantidad', 'Costo estimado', 'Importe estimado']],
    body: lineas.map((l) => [
      l.nombre,
      l.unidad,
      String(l.cantidad),
      l.costoEstimado !== null ? formatoMoneda(l.costoEstimado) : '—',
      l.importeEstimado !== null ? formatoMoneda(l.importeEstimado) : '—',
    ]),
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42] },
    margin: { left: MARGEN_X, right: MARGEN_X },
  });

  let finalY = doc.lastAutoTable.finalY + 8;
  if (totalEstimado !== null) {
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('Total estimado', 130, finalY);
    doc.text(formatoMoneda(totalEstimado), DERECHA, finalY, { align: 'right' });
    finalY += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text('Costo y disponibilidad sujetos a confirmación del proveedor.', MARGEN_X, finalY);
    finalY += 8;
  }

  let yFinal = finalY + 6;
  if (orden.observaciones) {
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30);
    doc.text('Observaciones', MARGEN_X, yFinal);
    yFinal += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80);
    const lineasObs = doc.splitTextToSize(orden.observaciones, DERECHA - MARGEN_X);
    doc.text(lineasObs, MARGEN_X, yFinal);
  }

  return doc;
}

export function generarPdfOrdenCompra(orden, empresa) {
  const doc = construirDocOrdenCompra(orden, empresa);
  doc.save(`${orden.folio || 'orden-compra'}.pdf`);
}

// Para el envío por correo: el backend no genera PDFs (ver correo.service.js), así que el
// frontend arma el mismo documento y lo manda en base64 crudo (sin el prefijo `data:...;base64,`
// del data URI que devuelve jsPDF).
export function generarBase64OrdenCompra(orden, empresa) {
  const doc = construirDocOrdenCompra(orden, empresa);
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',')[1];
  const nombreArchivo = `${orden.folio || 'orden-compra'}.pdf`;
  return { base64, nombreArchivo };
}
