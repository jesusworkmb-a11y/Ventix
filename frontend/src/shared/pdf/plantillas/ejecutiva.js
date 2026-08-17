import { jsPDF } from 'jspdf';
import { formatoFecha } from '../../format';
import {
  ANCHO_PAGINA, dibujarLogo, dibujarTablaConceptos, dibujarResumenFinanciero,
  dibujarPiePagina, dibujarInsigniaEstatus,
} from '../componentes';

const MARGEN_X = 20; // más generoso que el resto de las plantillas — "espacios amplios"
const DERECHA = ANCHO_PAGINA - MARGEN_X;
const ALTO_LOGO = 15;

// Plantilla 3 — Empresarial Ejecutiva: tipografía serif, distribución en columnas anchas,
// mucho espacio en blanco y línea de firma al pie. Transmite formalidad — inspirada en
// propuestas/informes corporativos.
function render(datos, tema) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  let y = 24;

  dibujarLogo(doc, datos.empresa, MARGEN_X, 14, ALTO_LOGO);
  const centroX = ANCHO_PAGINA / 2;

  doc.setFont('times', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...tema.primarioRgb);
  doc.text(datos.tituloDocumento, centroX, y, { align: 'center' });
  y += 6;
  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(datos.empresa?.nombreComercial || '', centroX, y, { align: 'center' });

  y += 9;
  doc.setDrawColor(...tema.secundarioRgb);
  doc.setLineWidth(0.4);
  doc.line(MARGEN_X, y, DERECHA, y);
  y += 10;

  // Dos columnas anchas: empresa (izq) / documento+contraparte (der)
  const anchoColumna = (DERECHA - MARGEN_X - 14) / 2;
  const xIzq = MARGEN_X;
  const xDer = MARGEN_X + anchoColumna + 14;
  let yIzq = y;
  let yDer = y;

  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...tema.primarioRgb);
  doc.text('EMISOR', xIzq, yIzq);
  yIzq += 5.5;
  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(50);
  [
    datos.empresa?.rfc && `RFC ${datos.empresa.rfc}`,
    datos.empresa?.direccion,
    datos.empresa?.telefono,
    datos.empresa?.correo,
    datos.empresa?.sitioWeb,
  ].filter(Boolean).forEach((linea) => { doc.text(linea, xIzq, yIzq, { maxWidth: anchoColumna }); yIzq += 5; });

  const c = datos.contraparte || {};
  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...tema.primarioRgb);
  doc.text((c.etiqueta || 'Cliente').toUpperCase(), xDer, yDer);
  yDer += 5.5;
  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(50);
  [
    c.nombre,
    c.rfc && `RFC ${c.rfc}`,
    c.telefono,
    c.correo,
    c.direccion,
  ].filter(Boolean).forEach((linea) => { doc.text(linea, xDer, yDer, { maxWidth: anchoColumna }); yDer += 5; });

  y = Math.max(yIzq, yDer) + 8;

  // Folio / fecha / estatus en una sola línea centrada, discreto
  doc.setFont('times', 'italic');
  doc.setFontSize(9.5);
  doc.setTextColor(90);
  doc.text(`Folio ${datos.folio || '-'}  ·  ${formatoFecha(datos.fecha)}`, xIzq, y);
  if (datos.estatus) {
    dibujarInsigniaEstatus(doc, { x: DERECHA, y: y - 2, texto: datos.estatus.texto, tono: datos.estatus.tono, fuente: 'times' });
  }

  y += 10;
  const finalTablaY = dibujarTablaConceptos(doc, {
    startY: y,
    conceptos: datos.conceptos,
    margenX: MARGEN_X,
    derecha: DERECHA,
    colorEncabezado: tema.primarioRgb,
    fuente: 'times',
    fontSize: 9,
  });

  const finalResumenY = dibujarResumenFinanciero(doc, {
    startY: finalTablaY + 9,
    resumen: datos.resumen,
    margenX: MARGEN_X,
    derecha: DERECHA,
    fuente: 'times',
    cajaTotal: false,
  });

  dibujarPiePagina(doc, {
    startY: finalResumenY + 14,
    empresa: datos.empresa,
    observaciones: datos.piePagina?.observaciones,
    margenX: MARGEN_X,
    derecha: DERECHA,
    fuente: 'times',
    mostrarFirma: true,
    qrDataUrl: datos.extra?.qrDataUrl,
    leyendaQr: datos.extra?.leyendaQr,
    datosFiscalesCfdi: datos.extra?.datosFiscalesCfdi,
  });

  return doc;
}

export default {
  coloresPorDefecto: { primario: '#1F2937', secundario: '#9CA3AF', acento: '#374151' },
  render,
};
