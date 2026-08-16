import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatoMoneda, formatoFecha } from '../../../shared/format';

const MARGEN_X = 15;
const ANCHO_PAGINA = 210;
const DERECHA = ANCHO_PAGINA - MARGEN_X;
const ALTO_LOGO = 16; // mm — ancho se deriva de la proporción real de la imagen

// Construye el jsPDF sin ningún efecto lateral (no descarga) — reusado tanto por
// generarPdfCompra (descarga directa) como por generarBase64Compra (envío por correo).
// A diferencia de Cotizacion (que no tiene columnas subtotal/impuestos propias y recalcula desde
// las líneas), Compra sí las persiste directo — se usan tal cual, sin recalcular, para que el PDF
// siempre coincida exactamente con lo que se guardó (compras registradas antes de este campo
// quedaron con impuestos=0 y subtotal=total, ver el backfill de la migración).
function construirDocCompra(compra, empresa) {
  const lineas = compra.detalles.map((d) => {
    const cantidad = Number(d.cantidad);
    const costo = Number(d.costo);
    const descuentoMonto = Number(d.descuentoMonto || 0);
    return {
      nombre: d.articulo?.nombre || d.articuloId,
      unidad: d.unidad?.abreviatura || d.unidad?.nombre || '',
      cantidad,
      costo,
      descuentoMonto,
      importe: cantidad * costo - descuentoMonto,
    };
  });
  const descuentoTotal = Math.round(lineas.reduce((acc, l) => acc + l.descuentoMonto, 0) * 100) / 100;
  const subtotal = Number(compra.subtotal);
  const impuestos = Number(compra.impuestos);
  const total = Number(compra.total);

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
  if (compra.folioProveedor) {
    y += 5;
    doc.text(`Folio del proveedor: ${compra.folioProveedor}`, DERECHA, y, { align: 'right' });
  }

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
    head: [['Artículo', 'Unidad', 'Cantidad', 'Costo unit.', 'Descuento', 'Importe']],
    body: lineas.map((l) => [
      l.nombre,
      l.unidad,
      String(l.cantidad),
      formatoMoneda(l.costo),
      l.descuentoMonto > 0 ? `-${formatoMoneda(l.descuentoMonto)}` : '—',
      formatoMoneda(l.importe),
    ]),
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42] },
    margin: { left: MARGEN_X, right: MARGEN_X },
  });

  let finalY = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(10);
  if (descuentoTotal > 0) {
    doc.text('Descuento', 150, finalY);
    doc.text(`-${formatoMoneda(descuentoTotal)}`, DERECHA, finalY, { align: 'right' });
    finalY += 6;
  }
  doc.text('Subtotal', 150, finalY);
  doc.text(formatoMoneda(subtotal), DERECHA, finalY, { align: 'right' });
  finalY += 6;
  doc.text('Impuestos', 150, finalY);
  doc.text(formatoMoneda(impuestos), DERECHA, finalY, { align: 'right' });
  finalY += 7;
  doc.setFont(undefined, 'bold');
  doc.setFontSize(12);
  doc.text('Total', 150, finalY);
  doc.text(formatoMoneda(total), DERECHA, finalY, { align: 'right' });

  let yFinal = finalY + 14;
  if (compra.observaciones) {
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30);
    doc.text('Observaciones', MARGEN_X, yFinal);
    yFinal += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80);
    const lineasObs = doc.splitTextToSize(compra.observaciones, DERECHA - MARGEN_X);
    doc.text(lineasObs, MARGEN_X, yFinal);
  }

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
