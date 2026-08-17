import { jsPDF } from 'jspdf';
import { formatoFecha } from '../../format';
import {
  MARGEN_X, DERECHA, ANCHO_PAGINA, dibujarLogo, dibujarTablaConceptos, dibujarResumenFinanciero,
  dibujarPiePagina, dibujarInsigniaEstatus, iconos, formatoMonedaOpcional,
} from '../componentes';

const ALTO_BANDA = 32;
const ALTO_LOGO = 14;

// Plantilla 2 — Profesional Moderna: banda de color primario en el header, "tarjetas"
// informativas (folio/fecha/estatus), separadores de color secundario y total destacado en
// una caja de color de acento. Inspirada en SaaS/ERP de nueva generación.
function render(datos, tema) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });

  doc.setFillColor(...tema.primarioRgb);
  doc.rect(0, 0, ANCHO_PAGINA, ALTO_BANDA, 'F');

  let xTexto = MARGEN_X;
  const anchoLogo = dibujarLogo(doc, datos.empresa, MARGEN_X, 8, ALTO_LOGO);
  if (anchoLogo) xTexto = MARGEN_X + anchoLogo + 5;

  doc.setTextColor(...tema.contrastePrimario);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(datos.empresa?.nombreComercial || '', xTexto, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const datosEmpresa = [
    datos.empresa?.rfc && `RFC: ${datos.empresa.rfc}`,
    datos.empresa?.direccion,
    datos.empresa?.telefono,
    datos.empresa?.correo,
  ].filter(Boolean).join('   ·   ');
  if (datosEmpresa) doc.text(datosEmpresa, xTexto, 22.5, { maxWidth: DERECHA - xTexto - 45 });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(datos.tituloDocumento, DERECHA, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Folio: ${datos.folio || '-'}`, DERECHA, 22.5, { align: 'right' });

  let y = ALTO_BANDA + 10;

  if (datos.estatus) {
    dibujarInsigniaEstatus(doc, { x: DERECHA, y: ALTO_BANDA + 6, texto: datos.estatus.texto, tono: datos.estatus.tono, fuente: 'helvetica' });
  }

  // Tres "tarjetas" (rects redondeados) con Fecha / Contraparte / Total, sobre fondo gris claro.
  const c = datos.contraparte || {};
  const anchoTarjeta = (DERECHA - MARGEN_X - 8) / 3;
  const tarjetas = [
    { titulo: 'Fecha', valor: formatoFecha(datos.fecha) },
    { titulo: (c.etiqueta || 'Cliente').toUpperCase(), valor: c.nombre || '—' },
    { titulo: 'Total', valor: datos.resumen ? formatoMonedaOpcional(datos.resumen.total) : '—' },
  ];
  tarjetas.forEach((t, i) => {
    const x = MARGEN_X + i * (anchoTarjeta + 4);
    doc.setFillColor(246, 247, 249);
    doc.roundedRect(x, y, anchoTarjeta, 16, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text(t.titulo, x + 4, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30);
    doc.text(String(t.valor), x + 4, y + 12.5, { maxWidth: anchoTarjeta - 8 });
  });

  y += 24;
  doc.setDrawColor(...tema.secundarioRgb);
  doc.setLineWidth(0.6);
  doc.line(MARGEN_X, y, DERECHA, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...tema.primarioRgb);
  doc.text((c.etiqueta || 'Cliente').toUpperCase(), MARGEN_X, y);
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70);
  const lineasContacto = [
    { tipo: 'telefono', texto: c.telefono },
    { tipo: 'correo', texto: c.correo },
    { tipo: 'ubicacion', texto: c.direccion },
  ].filter((l) => l.texto);
  lineasContacto.forEach((l) => {
    iconos[l.tipo](doc, MARGEN_X, y - 2.5, 3.2, tema.acento);
    doc.text(l.texto, MARGEN_X + 6, y);
    y += 4.8;
  });
  if (c.rfc) { doc.text(`RFC: ${c.rfc}`, MARGEN_X, y); y += 4.8; }

  y += 4;
  const finalTablaY = dibujarTablaConceptos(doc, {
    startY: y,
    conceptos: datos.conceptos,
    colorEncabezado: tema.primarioRgb,
    fuente: 'helvetica',
  });

  const finalResumenY = dibujarResumenFinanciero(doc, {
    startY: finalTablaY + 8,
    resumen: datos.resumen,
    fuente: 'helvetica',
    cajaTotal: true,
    colorTotalRgb: tema.acentoRgb,
    contrasteTotalRgb: tema.contrasteAcento,
  });

  dibujarPiePagina(doc, {
    startY: finalResumenY + 12,
    empresa: datos.empresa,
    observaciones: datos.piePagina?.observaciones,
    fuente: 'helvetica',
    mostrarFirma: false,
    qrDataUrl: datos.extra?.qrDataUrl,
    leyendaQr: datos.extra?.leyendaQr,
    datosFiscalesCfdi: datos.extra?.datosFiscalesCfdi,
  });

  return doc;
}

export default {
  coloresPorDefecto: { primario: '#0F172A', secundario: '#3B82F6', acento: '#2563EB' },
  render,
};
