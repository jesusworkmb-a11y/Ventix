import { jsPDF } from 'jspdf';
import { formatoFecha } from '../../format';
import {
  MARGEN_X, DERECHA, dibujarLogo, dibujarTablaConceptos, dibujarResumenFinanciero,
  dibujarPiePagina, dibujarInsigniaEstatus,
} from '../componentes';

const ALTO_LOGO = 15;

// Plantilla 1 — Clásica Minimalista: fondo blanco, header horizontal simple, tabla con bordes
// discretos, casi sin color (encabezado de tabla gris neutro salvo un acento mínimo en el
// total). Inspirada en facturas corporativas tradicionales — máxima legibilidad.
function render(datos, tema) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  let y = 18;
  let xTexto = MARGEN_X;

  const anchoLogo = dibujarLogo(doc, datos.empresa, MARGEN_X, 10, ALTO_LOGO);
  if (anchoLogo) xTexto = MARGEN_X + anchoLogo + 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20);
  doc.text(datos.empresa?.nombreComercial || '', xTexto, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(60);
  doc.text(datos.tituloDocumento, DERECHA, y, { align: 'right' });

  y += 5.5;
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  const datosEmpresa = [
    datos.empresa?.rfc && `RFC: ${datos.empresa.rfc}`,
    datos.empresa?.direccion,
    datos.empresa?.telefono,
    datos.empresa?.correo,
  ].filter(Boolean).join('   ·   ');
  if (datosEmpresa) doc.text(datosEmpresa, xTexto, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20);
  doc.text(`Folio: ${datos.folio || '-'}`, DERECHA, y, { align: 'right' });

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110);
  doc.text(`Fecha: ${formatoFecha(datos.fecha)}`, DERECHA, y, { align: 'right' });

  if (datos.estatus) {
    y += 6.5;
    dibujarInsigniaEstatus(doc, { x: DERECHA, y, texto: datos.estatus.texto, tono: datos.estatus.tono, fuente: 'helvetica' });
  }

  y += 6;
  doc.setDrawColor(215);
  doc.setLineWidth(0.3);
  doc.line(MARGEN_X, y, DERECHA, y);
  y += 8;

  const c = datos.contraparte || {};
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30);
  doc.text((c.etiqueta || 'Cliente').toUpperCase(), MARGEN_X, y);
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text(c.nombre || '', MARGEN_X, y);
  y += 5;
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  const contacto = [c.rfc && `RFC: ${c.rfc}`, c.telefono, c.correo].filter(Boolean).join('   ·   ');
  if (contacto) { doc.text(contacto, MARGEN_X, y); y += 4.5; }
  if (c.direccion) { doc.text(c.direccion, MARGEN_X, y); y += 4.5; }
  if (c.infoFiscal) {
    const fiscal = [
      c.infoFiscal.regimen && `Régimen: ${c.infoFiscal.regimen}`,
      c.infoFiscal.usoCfdi && `Uso CFDI: ${c.infoFiscal.usoCfdi}`,
      c.infoFiscal.domicilioFiscalCp && `CP fiscal: ${c.infoFiscal.domicilioFiscalCp}`,
    ].filter(Boolean).join('   ·   ');
    if (fiscal) { doc.text(fiscal, MARGEN_X, y); y += 4.5; }
  }

  y += 5;
  const finalTablaY = dibujarTablaConceptos(doc, {
    startY: y,
    conceptos: datos.conceptos,
    colorEncabezado: [71, 85, 105],
    fuente: 'helvetica',
  });

  const finalResumenY = dibujarResumenFinanciero(doc, {
    startY: finalTablaY + 8,
    resumen: datos.resumen,
    fuente: 'helvetica',
    cajaTotal: false,
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
  coloresPorDefecto: { primario: '#1E293B', secundario: '#64748B', acento: '#334155' },
  render,
};
