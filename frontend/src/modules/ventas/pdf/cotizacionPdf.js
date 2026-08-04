import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatoMoneda, formatoFecha } from '../../../shared/format';

const MARGEN_X = 15;
const ANCHO_PAGINA = 210;
const DERECHA = ANCHO_PAGINA - MARGEN_X;

// Cotizacion.total (el campo que guarda el backend) es el subtotal sin impuesto — el impuesto
// se calcula recién al convertir en venta, con la tasa vigente en ese momento (mismo criterio
// que CotizacionesPage#abrirConversion). El PDF necesita mostrarle al cliente el total real que
// pagaría, así que recalcula subtotal/impuestos/total línea por línea igual que esa función,
// resolviendo la tasa desde el catálogo completo de artículos (`articulosCompletos`, ya cargado
// en la página) porque `obtenerCotizacion` no trae el impuesto de cada artículo.
function calcularTotales(cotizacion, articulosCompletos) {
  const articuloPorId = new Map(articulosCompletos.map((a) => [a.id, a]));
  let subtotal = 0;
  let impuestos = 0;
  const lineas = cotizacion.detalles.map((d) => {
    const cantidad = Number(d.cantidad);
    const precio = Number(d.precio);
    const importe = cantidad * precio;
    const tasa = articuloPorId.get(d.articuloId)?.impuesto ? Number(articuloPorId.get(d.articuloId).impuesto.tasa) : 0;
    subtotal += importe;
    impuestos += importe * tasa;
    return { nombre: d.articulo?.nombre || d.articuloId, cantidad, precio, importe };
  });
  subtotal = Math.round(subtotal * 100) / 100;
  impuestos = Math.round(impuestos * 100) / 100;
  const total = Math.round((subtotal + impuestos) * 100) / 100;
  return { lineas, subtotal, impuestos, total };
}

const ALTO_LOGO = 16; // mm — ancho se deriva de la proporción real de la imagen

export function generarPdfCotizacion(cotizacion, empresa, articulosCompletos) {
  const { lineas, subtotal, impuestos, total } = calcularTotales(cotizacion, articulosCompletos);
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  let y = 20;
  let xTexto = MARGEN_X;

  // El logo (data URI PNG generado en EmpresaPage) empuja el nombre/datos de la empresa a la
  // derecha en vez de superponerse — si no hay logo, xTexto queda igual a MARGEN_X. Un logo
  // corrupto o con un formato que jsPDF no pueda leer no debe tumbar la generación del PDF.
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
  doc.text('COTIZACIÓN', DERECHA, y, { align: 'right' });

  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  y += 6;
  const datosEmpresa = [empresa?.rfc && `RFC: ${empresa.rfc}`, empresa?.telefono, empresa?.correo]
    .filter(Boolean).join(' · ');
  if (datosEmpresa) { doc.text(datosEmpresa, xTexto, y); }
  doc.text(`Folio: ${cotizacion.folio || '-'}`, DERECHA, y, { align: 'right' });
  y += 5;
  if (cotizacion.sucursal?.nombre) {
    const sucursalTexto = cotizacion.sucursal.direccion
      ? `${cotizacion.sucursal.nombre} — ${cotizacion.sucursal.direccion}`
      : cotizacion.sucursal.nombre;
    doc.text(sucursalTexto, xTexto, y);
  }
  doc.text(`Fecha: ${formatoFecha(cotizacion.creadoEn)}`, DERECHA, y, { align: 'right' });

  y += 10;
  doc.setDrawColor(210);
  doc.line(MARGEN_X, y, DERECHA, y);
  y += 8;

  doc.setTextColor(30);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.text('Cliente', MARGEN_X, y);
  y += 5;
  doc.setFont(undefined, 'normal');
  doc.text(cotizacion.cliente?.nombre || '', MARGEN_X, y);
  y += 5;
  const contacto = [cotizacion.cliente?.telefono, cotizacion.cliente?.correo].filter(Boolean).join(' · ');
  if (contacto) { doc.text(contacto, MARGEN_X, y); y += 5; }
  if (cotizacion.cliente?.direccion) { doc.text(cotizacion.cliente.direccion, MARGEN_X, y); y += 5; }

  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Artículo', 'Cantidad', 'Precio unit.', 'Importe']],
    body: lineas.map((l) => [l.nombre, String(l.cantidad), formatoMoneda(l.precio), formatoMoneda(l.importe)]),
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42] },
    margin: { left: MARGEN_X, right: MARGEN_X },
  });

  let finalY = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(10);
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

  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(
    'Cotización sujeta a disponibilidad de stock y a la vigencia de los precios al momento de la compra.',
    MARGEN_X,
    finalY + 14,
  );

  doc.save(`${cotizacion.folio || 'cotizacion'}.pdf`);
}
