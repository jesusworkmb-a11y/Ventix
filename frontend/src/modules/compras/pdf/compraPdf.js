import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatoMoneda, formatoFecha } from '../../../shared/format';

const MARGEN_X = 15;
const ANCHO_PAGINA = 210;
const DERECHA = ANCHO_PAGINA - MARGEN_X;
const ALTO_LOGO = 16; // mm — ancho se deriva de la proporción real de la imagen

// Construye el jsPDF sin ningún efecto lateral (no descarga) — reusado tanto por
// generarPdfCompra (descarga directa) como por generarBase64Compra (envío por correo).
// A diferencia de Cotizacion, CompraDetalle.costo no lleva un impuesto separado (§17.5) — el
// costo congelado en la línea ya es el importe total por unidad, así que no hace falta
// recalcular subtotal/impuestos como en cotizacionPdf.js, solo sumar cantidad × costo.
function construirDocCompra(compra, empresa) {
  const lineas = compra.detalles.map((d) => {
    const cantidad = Number(d.cantidad);
    const costo = Number(d.costo);
    return {
      nombre: d.articulo?.nombre || d.articuloId,
      unidad: d.unidad?.abreviatura || d.unidad?.nombre || '',
      cantidad,
      costo,
      importe: cantidad * costo,
    };
  });
  const total = Math.round(lineas.reduce((acc, l) => acc + l.importe, 0) * 100) / 100;

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
  doc.text('COMPRA', DERECHA, y, { align: 'right' });

  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  y += 6;
  const datosEmpresa = [empresa?.rfc && `RFC: ${empresa.rfc}`, empresa?.telefono, empresa?.correo]
    .filter(Boolean).join(' · ');
  if (datosEmpresa) { doc.text(datosEmpresa, xTexto, y); }
  doc.text(`Folio: ${compra.folio || '-'}`, DERECHA, y, { align: 'right' });
  y += 5;
  if (compra.sucursal?.nombre) {
    const sucursalTexto = compra.sucursal.direccion
      ? `${compra.sucursal.nombre} — ${compra.sucursal.direccion}`
      : compra.sucursal.nombre;
    doc.text(sucursalTexto, xTexto, y);
  }
  doc.text(`Fecha: ${formatoFecha(compra.creadoEn)}`, DERECHA, y, { align: 'right' });

  if (compra.estado === 'CANCELADA') {
    y += 6;
    doc.setFont(undefined, 'bold');
    doc.setTextColor(200, 40, 40);
    doc.text('** COMPRA CANCELADA **', DERECHA, y, { align: 'right' });
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
  }

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
  doc.text(compra.proveedor?.nombre || '', MARGEN_X, y);
  y += 5;
  const contacto = [compra.proveedor?.telefono, compra.proveedor?.correo].filter(Boolean).join(' · ');
  if (contacto) { doc.text(contacto, MARGEN_X, y); y += 5; }
  if (compra.proveedor?.direccion) { doc.text(compra.proveedor.direccion, MARGEN_X, y); y += 5; }

  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Artículo', 'Unidad', 'Cantidad', 'Costo unit.', 'Importe']],
    body: lineas.map((l) => [
      l.nombre, l.unidad, String(l.cantidad), formatoMoneda(l.costo), formatoMoneda(l.importe),
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
  doc.setFont(undefined, 'bold');
  doc.setFontSize(12);
  doc.text('Total', 150, finalY);
  doc.text(formatoMoneda(total), DERECHA, finalY, { align: 'right' });

  return doc;
}

export function generarPdfCompra(compra, empresa) {
  const doc = construirDocCompra(compra, empresa);
  doc.save(`${compra.folio || 'compra'}.pdf`);
}

// Para el envío por correo: el backend no genera PDFs (ver correo.service.js), así que el
// frontend arma el mismo documento y lo manda en base64 crudo (sin el prefijo `data:...;base64,`
// del data URI que devuelve jsPDF).
export function generarBase64Compra(compra, empresa) {
  const doc = construirDocCompra(compra, empresa);
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',')[1];
  const nombreArchivo = `${compra.folio || 'compra'}.pdf`;
  return { base64, nombreArchivo };
}
