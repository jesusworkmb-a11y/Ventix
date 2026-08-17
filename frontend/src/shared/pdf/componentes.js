import autoTable from 'jspdf-autotable';
import { formatoMoneda } from '../format';
import { hexToRgb } from './tema';

// Orden de compra puede no tener costoEstimado (es una solicitud, no un documento fiscal) —
// null/undefined se muestra como "—" en vez de "$0.00" para no dar a entender que algo es
// gratis cuando en realidad no se cotizó todavía.
export function formatoMonedaOpcional(valor) {
  return valor === null || valor === undefined ? '—' : formatoMoneda(valor);
}

const MARGEN_X = 15;
export const ANCHO_PAGINA = 210;
export const DERECHA = ANCHO_PAGINA - MARGEN_X;
export { MARGEN_X };

// Logo (data URI PNG generado en EmpresaPage) — extraído de la copia idéntica que vivía en
// cotizacionPdf.js/compraPdf.js/ordenCompraPdf.js/reportePdf.js. Un logo corrupto o en un
// formato que jsPDF no pueda leer no debe tumbar la generación del PDF.
export function dibujarLogo(doc, empresa, x, y, altoMm) {
  if (!empresa?.logoUrl) return 0;
  try {
    const propiedades = doc.getImageProperties(empresa.logoUrl);
    const ancho = (propiedades.width / propiedades.height) * altoMm;
    doc.addImage(empresa.logoUrl, 'PNG', x, y, ancho, altoMm);
    return ancho;
  } catch (err) {
    return 0;
  }
}

// Iconos vectoriales mínimos (sin assets externos): pictogramas simples armados con las
// primitivas de dibujo de jsPDF (rect/circle/ellipse/triangle/line), recoloreados con el color
// de acento del tema de cada plantilla. A la escala en que se usan (~3-4mm) priorizan
// reconocibilidad rápida sobre fidelidad, mismo criterio que un bullet de color con forma.
export const iconos = {
  empresa(doc, x, y, s, hex) {
    const [r, g, b] = hexToRgb(hex);
    doc.setFillColor(r, g, b);
    doc.rect(x, y, s, s, 'F');
    doc.setFillColor(255, 255, 255);
    const pad = s * 0.18;
    const celda = (s - pad * 3) / 2;
    doc.rect(x + pad, y + pad, celda, celda, 'F');
    doc.rect(x + pad * 2 + celda, y + pad, celda, celda, 'F');
    doc.rect(x + pad, y + pad * 2 + celda, celda, celda, 'F');
    doc.rect(x + pad * 2 + celda, y + pad * 2 + celda, celda, celda, 'F');
  },
  cliente(doc, x, y, s, hex) {
    const [r, g, b] = hexToRgb(hex);
    doc.setFillColor(r, g, b);
    doc.circle(x + s / 2, y + s * 0.32, s * 0.22, 'F');
    doc.ellipse(x + s / 2, y + s * 0.86, s * 0.36, s * 0.24, 'F');
  },
  telefono(doc, x, y, s, hex) {
    const [r, g, b] = hexToRgb(hex);
    doc.setFillColor(r, g, b);
    doc.circle(x + s * 0.28, y + s * 0.28, s * 0.18, 'F');
    doc.circle(x + s * 0.72, y + s * 0.72, s * 0.18, 'F');
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(s * 0.16);
    doc.line(x + s * 0.36, y + s * 0.44, x + s * 0.64, y + s * 0.56);
  },
  correo(doc, x, y, s, hex) {
    const [r, g, b] = hexToRgb(hex);
    doc.setFillColor(r, g, b);
    doc.rect(x, y + s * 0.15, s, s * 0.7, 'F');
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(s * 0.07);
    doc.line(x, y + s * 0.17, x + s / 2, y + s * 0.56);
    doc.line(x + s, y + s * 0.17, x + s / 2, y + s * 0.56);
  },
  ubicacion(doc, x, y, s, hex) {
    const [r, g, b] = hexToRgb(hex);
    doc.setFillColor(r, g, b);
    doc.circle(x + s / 2, y + s * 0.34, s * 0.34, 'F');
    doc.triangle(x + s * 0.2, y + s * 0.48, x + s * 0.8, y + s * 0.48, x + s / 2, y + s * 0.94, 'F');
    doc.setFillColor(255, 255, 255);
    doc.circle(x + s / 2, y + s * 0.34, s * 0.13, 'F');
  },
  impuesto(doc, x, y, s, hex) {
    const [r, g, b] = hexToRgb(hex);
    doc.setFillColor(r, g, b);
    doc.circle(x + s / 2, y + s / 2, s / 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(s * 2.4);
    doc.text('%', x + s / 2, y + s * 0.68, { align: 'center' });
  },
  total(doc, x, y, s, hex) {
    const [r, g, b] = hexToRgb(hex);
    doc.setFillColor(r, g, b);
    doc.circle(x + s / 2, y + s / 2, s / 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(s * 2.4);
    doc.text('$', x + s / 2, y + s * 0.68, { align: 'center' });
  },
  observaciones(doc, x, y, s, hex) {
    const [r, g, b] = hexToRgb(hex);
    doc.setFillColor(r, g, b);
    doc.rect(x, y, s, s, 'F');
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(s * 0.09);
    [0.3, 0.5, 0.7].forEach((f) => doc.line(x + s * 0.18, y + s * f, x + s * 0.82, y + s * f));
  },
};

const COLORES_ESTATUS = {
  neutro: [100, 116, 139],
  exito: [22, 163, 74],
  peligro: [220, 38, 38],
  advertencia: [217, 119, 6],
};

export function colorEstatus(tono) {
  return COLORES_ESTATUS[tono] || COLORES_ESTATUS.neutro;
}

// Insignia de estatus del documento (VIGENTE/CONFIRMADA/CANCELADA/TIMBRADA/...) — mismo
// componente en todas las plantillas, coloreado según `estatus.tono`.
export function dibujarInsigniaEstatus(doc, { x, y, texto, tono, fuente = 'helvetica', align = 'right' }) {
  const color = colorEstatus(tono);
  doc.setFont(fuente, 'bold');
  doc.setFontSize(8);
  const anchoTexto = doc.getTextWidth(texto.toUpperCase()) + 6;
  const xCaja = align === 'right' ? x - anchoTexto : x;
  doc.setFillColor(...color);
  doc.roundedRect(xCaja, y - 3.6, anchoTexto, 5.4, 1.3, 1.3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(texto.toUpperCase(), xCaja + anchoTexto / 2, y, { align: 'center' });
  return anchoTexto;
}

// Tabla de conceptos compartida por las 5 plantillas tabulares (Plantilla 5 — Catálogo — usa
// tarjetas en su lugar). Columnas fijas según el brief de diseño: todas las plantillas
// muestran la misma información, solo cambia el estilo (color de encabezado/fuente/tamaño).
export function dibujarTablaConceptos(doc, {
  startY, conceptos, margenX = MARGEN_X, derecha = DERECHA,
  colorEncabezado, colorTextoEncabezado = [255, 255, 255], fuente = 'helvetica', fontSize = 8.5,
  colorFilaAlterna = null,
}) {
  autoTable(doc, {
    startY,
    head: [['Código', 'Descripción', 'Cant.', 'Unidad', 'Precio unit.', 'Descuento', 'Impuesto', 'Importe']],
    body: conceptos.map((c) => [
      c.codigo || '—',
      c.descripcion || '',
      String(c.cantidad),
      c.unidad || '—',
      formatoMonedaOpcional(c.precioUnitario),
      c.descuento > 0 ? `-${formatoMoneda(c.descuento)}` : '—',
      c.impuestoTexto || '—',
      formatoMonedaOpcional(c.importe),
    ]),
    columnStyles: {
      2: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
    styles: { fontSize, cellPadding: 2.6, font: fuente },
    headStyles: { fillColor: colorEncabezado, textColor: colorTextoEncabezado, font: fuente, fontStyle: 'bold' },
    alternateRowStyles: colorFilaAlterna ? { fillColor: colorFilaAlterna } : undefined,
    margin: { left: margenX, right: ANCHO_PAGINA - derecha },
  });
  return doc.lastAutoTable.finalY;
}

// Resumen financiero (Subtotal/Descuento/Impuestos/Total) compartido. `cajaTotal` dibuja el
// Total dentro de una caja de color (plantillas Moderna/Comercial/Premium); sin ella el Total
// es solo texto grande en negrita (Clásica/Ejecutiva/Catálogo).
export function dibujarResumenFinanciero(doc, {
  startY, resumen, margenX = MARGEN_X, derecha = DERECHA, fuente = 'helvetica',
  colorTotalRgb = null, contrasteTotalRgb = [255, 255, 255], cajaTotal = false,
}) {
  let y = startY;
  const xEtiqueta = derecha - 58;
  doc.setFont(fuente, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  if (resumen.descuentoTotal > 0) {
    doc.text('Descuento', xEtiqueta, y);
    doc.text(`-${formatoMoneda(resumen.descuentoTotal)}`, derecha, y, { align: 'right' });
    y += 6;
  }
  doc.text('Subtotal', xEtiqueta, y);
  doc.text(formatoMonedaOpcional(resumen.subtotal), derecha, y, { align: 'right' });
  y += 6;
  doc.text('Impuestos', xEtiqueta, y);
  doc.text(formatoMonedaOpcional(resumen.impuestos), derecha, y, { align: 'right' });
  y += 9;

  if (cajaTotal && colorTotalRgb) {
    doc.setFillColor(...colorTotalRgb);
    doc.roundedRect(xEtiqueta - 5, y - 7, derecha - xEtiqueta + 5, 12.5, 2, 2, 'F');
    doc.setTextColor(...contrasteTotalRgb);
  } else {
    doc.setTextColor(20);
  }
  doc.setFont(fuente, 'bold');
  doc.setFontSize(13);
  doc.text('Total', xEtiqueta, y + 1.2);
  doc.text(formatoMonedaOpcional(resumen.total), derecha, y + 1.2, { align: 'right' });
  return y + 10;
}

// Pie de página compartido: observaciones del documento + términos/datos bancarios (config.
// de empresa, reusados en todos los documentos que los llevan) + firma opcional + QR opcional
// (solo Factura CFDI trae qrDataUrl — Cotización/Compra no tienen una URL pública que verificar).
export function dibujarPiePagina(doc, {
  startY, empresa, observaciones, margenX = MARGEN_X, derecha = DERECHA, fuente = 'helvetica',
  mostrarFirma = false, qrDataUrl = null, leyendaQr = '', datosFiscalesCfdi = null,
}) {
  let y = startY;
  const anchoTexto = (qrDataUrl ? derecha - 30 : derecha) - margenX;

  function bloqueTexto(titulo, texto, tamTitulo, tamTexto) {
    doc.setFont(fuente, 'bold');
    doc.setFontSize(tamTitulo);
    doc.setTextColor(30);
    doc.text(titulo, margenX, y);
    y += tamTitulo * 0.55;
    doc.setFont(fuente, 'normal');
    doc.setFontSize(tamTexto);
    doc.setTextColor(100);
    const lineas = doc.splitTextToSize(texto, anchoTexto);
    doc.text(lineas, margenX, y);
    y += lineas.length * (tamTexto * 0.5) + 5;
  }

  if (observaciones) bloqueTexto('Observaciones', observaciones, 9, 9);
  if (empresa?.terminosCondicionesPdf) bloqueTexto('Términos y condiciones', empresa.terminosCondicionesPdf, 8, 7.5);
  if (empresa?.datosBancarios) bloqueTexto('Datos bancarios', empresa.datosBancarios, 8, 7.5);

  if (mostrarFirma) {
    const anchoFirma = 55;
    const xFirma = derecha - anchoFirma;
    doc.setDrawColor(170);
    doc.setLineWidth(0.3);
    doc.line(xFirma, y + 8, derecha, y + 8);
    doc.setFont(fuente, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text('Firma autorizada', xFirma + anchoFirma / 2, y + 12, { align: 'center' });
    y += 14;
  }

  // Elementos que el SAT exige en la representación impresa de un CFDI (Anexo 20) — se dibujan
  // en monoespaciada y letra chica, mismo criterio visual que usan todos los PACs/ERPs para
  // este bloque técnico, sin importar qué tan elaborada sea el resto de la plantilla.
  if (datosFiscalesCfdi?.uuid) {
    y += 2;
    doc.setDrawColor(215);
    doc.setLineWidth(0.2);
    doc.line(margenX, y, (qrDataUrl ? derecha - 30 : derecha), y);
    y += 4.5;
    const filas = [
      `Folio fiscal (UUID): ${datosFiscalesCfdi.uuid}`,
      datosFiscalesCfdi.fechaTimbrado && `Fecha y hora de certificación: ${datosFiscalesCfdi.fechaTimbrado}`,
      datosFiscalesCfdi.lugarExpedicion && `Lugar de expedición: ${datosFiscalesCfdi.lugarExpedicion}`,
      datosFiscalesCfdi.noCertificadoSAT && `No. de serie del certificado del SAT: ${datosFiscalesCfdi.noCertificadoSAT}`,
      datosFiscalesCfdi.noCertificadoEmisor && `No. de serie del CSD del emisor: ${datosFiscalesCfdi.noCertificadoEmisor}`,
      datosFiscalesCfdi.selloSAT && `Sello digital del SAT: ${datosFiscalesCfdi.selloSAT}`,
      datosFiscalesCfdi.selloEmisor && `Sello digital del CFDI: ${datosFiscalesCfdi.selloEmisor}`,
      datosFiscalesCfdi.cadenaOriginal && `Cadena original del complemento de certificación digital del SAT: ${datosFiscalesCfdi.cadenaOriginal}`,
    ].filter(Boolean);
    doc.setFont('courier', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(110);
    filas.forEach((fila) => {
      const lineas = doc.splitTextToSize(fila, anchoTexto);
      doc.text(lineas, margenX, y);
      y += lineas.length * 2.6 + 1.4;
    });
    y += 2;
    doc.setFont(fuente, 'italic');
    doc.setFontSize(7);
    doc.setTextColor(130);
    const lineasLeyenda = doc.splitTextToSize(
      'Este documento es una representación impresa de un CFDI. Su autenticidad puede verificarse en el portal del SAT.',
      anchoTexto,
    );
    doc.text(lineasLeyenda, margenX, y);
    y += lineasLeyenda.length * 3.4;
  }

  if (qrDataUrl) {
    const qrTam = 24;
    const qrX = derecha - qrTam;
    const qrY = startY;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrTam, qrTam);
    if (leyendaQr) {
      doc.setFont(fuente, 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(120);
      const lineasQr = doc.splitTextToSize(leyendaQr, qrTam + 6);
      doc.text(lineasQr, qrX + qrTam / 2, qrY + qrTam + 3.5, { align: 'center' });
    }
  }

  return y;
}

// Bloque de contacto de empresa/contraparte con iconos — reusado por varias plantillas para
// listar teléfono/correo/dirección sin repetir el patrón "si existe, dibuja renglón".
export function dibujarLineasContacto(doc, { x, y, ancho, lineas, fuente = 'helvetica', colorAcento, tamIcono = 3.4, colorTexto = 90 }) {
  let yActual = y;
  lineas.forEach(({ tipo, texto }) => {
    if (!texto) return;
    if (iconos[tipo]) iconos[tipo](doc, x, yActual - tamIcono * 0.75, tamIcono, colorAcento);
    doc.setFont(fuente, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(colorTexto);
    doc.text(texto, x + tamIcono + 2.5, yActual, { maxWidth: ancho - tamIcono - 2.5 });
    yActual += 5;
  });
  return yActual;
}
