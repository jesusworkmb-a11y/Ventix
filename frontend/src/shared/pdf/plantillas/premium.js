import { jsPDF } from 'jspdf';
import { formatoFecha } from '../../format';
import {
  MARGEN_X, DERECHA, ANCHO_PAGINA, dibujarLogo, dibujarTablaConceptos, dibujarResumenFinanciero,
  dibujarPiePagina, dibujarInsigniaEstatus, iconos,
} from '../componentes';

const ALTO_BANNER = 58;
const ALTO_LOGO = 20;

// Plantilla 6 — Corporativa Premium: banner de marca a todo el ancho en la parte superior con
// el logo en tamaño grande, secciones bien diferenciadas con más padding y footer con
// firma+QR+datos bancarios. Máxima presencia de marca — inspirada en documentos ejecutivos
// de alto impacto visual. (jsPDF no soporta gradientes CSS reales: el banner es un bloque de
// color sólido, no un degradado.)
function render(datos, tema) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });

  doc.setFillColor(...tema.primarioRgb);
  doc.rect(0, 0, ANCHO_PAGINA, ALTO_BANNER, 'F');
  doc.setFillColor(...tema.acentoRgb);
  doc.rect(0, ALTO_BANNER - 3, ANCHO_PAGINA, 3, 'F');

  dibujarLogo(doc, datos.empresa, MARGEN_X, 12, ALTO_LOGO);

  doc.setTextColor(...tema.contrastePrimario);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(datos.empresa?.nombreComercial || '', ANCHO_PAGINA - MARGEN_X, 22, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const datosEmpresa = [
    datos.empresa?.rfc && `RFC: ${datos.empresa.rfc}`,
    datos.empresa?.direccion,
    datos.empresa?.telefono,
    datos.empresa?.correo,
  ].filter(Boolean).join('   ·   ');
  if (datosEmpresa) doc.text(datosEmpresa, ANCHO_PAGINA - MARGEN_X, 29, { align: 'right', maxWidth: 150 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(datos.tituloDocumento, ANCHO_PAGINA - MARGEN_X, 46, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Folio ${datos.folio || '-'}  ·  ${formatoFecha(datos.fecha)}`, ANCHO_PAGINA - MARGEN_X, 52, { align: 'right' });

  let y = ALTO_BANNER + 12;
  if (datos.estatus) {
    dibujarInsigniaEstatus(doc, { x: DERECHA, y: ALTO_BANNER + 8, texto: datos.estatus.texto, tono: datos.estatus.tono, fuente: 'helvetica' });
  }

  // Panel diferenciado para la contraparte, con más padding que el resto de plantillas.
  const c = datos.contraparte || {};
  const altoPanel = 26;
  doc.setFillColor(248, 249, 251);
  doc.setDrawColor(235);
  doc.roundedRect(MARGEN_X, y, DERECHA - MARGEN_X, altoPanel, 2.5, 2.5, 'FD');
  let yPanel = y + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...tema.primarioRgb);
  doc.text((c.etiqueta || 'Cliente').toUpperCase(), MARGEN_X + 6, yPanel);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(25);
  doc.text(c.nombre || '', MARGEN_X + 55, yPanel);
  yPanel += 8;
  const lineasContacto = [
    { tipo: 'telefono', texto: c.telefono },
    { tipo: 'correo', texto: c.correo },
    { tipo: 'ubicacion', texto: c.direccion },
  ].filter((l) => l.texto);
  let xContacto = MARGEN_X + 6;
  lineasContacto.forEach((l) => {
    iconos[l.tipo](doc, xContacto, yPanel - 2.6, 3.2, tema.acento);
    doc.setFontSize(8.5);
    doc.setTextColor(90);
    doc.text(l.texto, xContacto + 5, yPanel);
    xContacto += doc.getTextWidth(l.texto) + 16;
  });
  if (c.rfc) {
    doc.setFontSize(8.5);
    doc.setTextColor(90);
    doc.text(`RFC: ${c.rfc}`, xContacto, yPanel);
  }

  y += altoPanel + 10;
  const finalTablaY = dibujarTablaConceptos(doc, {
    startY: y,
    conceptos: datos.conceptos,
    colorEncabezado: tema.primarioRgb,
    fuente: 'helvetica',
    colorFilaAlterna: [248, 249, 251],
  });

  const finalResumenY = dibujarResumenFinanciero(doc, {
    startY: finalTablaY + 9,
    resumen: datos.resumen,
    fuente: 'helvetica',
    cajaTotal: true,
    colorTotalRgb: tema.acentoRgb,
    contrasteTotalRgb: tema.contrasteAcento,
  });

  dibujarPiePagina(doc, {
    startY: finalResumenY + 14,
    empresa: datos.empresa,
    observaciones: datos.piePagina?.observaciones,
    fuente: 'helvetica',
    mostrarFirma: true,
    qrDataUrl: datos.extra?.qrDataUrl,
    leyendaQr: datos.extra?.leyendaQr,
    datosFiscalesCfdi: datos.extra?.datosFiscalesCfdi,
  });

  return doc;
}

export default {
  coloresPorDefecto: { primario: '#111827', secundario: '#4B5563', acento: '#B45309' },
  render,
};
