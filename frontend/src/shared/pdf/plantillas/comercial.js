import { jsPDF } from 'jspdf';
import { formatoFecha } from '../../format';
import {
  MARGEN_X, DERECHA, dibujarLogo, dibujarTablaConceptos, formatoMonedaOpcional,
  dibujarPiePagina, dibujarInsigniaEstatus, iconos,
} from '../componentes';

const ALTO_LOGO = 15;

// Plantilla 4 — Comercial de Ventas: orientada a cerrar la venta — total muy visible, banda de
// condiciones comerciales destacada, y un llamado a la aprobación/firma al final. Inspirada en
// cotizaciones y propuestas de equipos comerciales.
function render(datos, tema) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  let y = 20;
  let xTexto = MARGEN_X;

  const anchoLogo = dibujarLogo(doc, datos.empresa, MARGEN_X, 10, ALTO_LOGO);
  if (anchoLogo) xTexto = MARGEN_X + anchoLogo + 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text(datos.empresa?.nombreComercial || '', xTexto, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...tema.acentoRgb);
  doc.text(datos.tituloDocumento, DERECHA, y, { align: 'right' });

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  const datosEmpresa = [
    datos.empresa?.rfc && `RFC: ${datos.empresa.rfc}`,
    datos.empresa?.direccion,
    datos.empresa?.telefono,
    datos.empresa?.correo,
  ].filter(Boolean).join('   ·   ');
  if (datosEmpresa) doc.text(datosEmpresa, xTexto, y, { maxWidth: DERECHA - xTexto - 55 });
  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`Folio: ${datos.folio || '-'}  ·  ${formatoFecha(datos.fecha)}`, DERECHA, y, { align: 'right' });

  y += 8;
  if (datos.estatus) {
    dibujarInsigniaEstatus(doc, { x: DERECHA, y, texto: datos.estatus.texto, tono: datos.estatus.tono, fuente: 'helvetica' });
  }

  // Banda de condiciones comerciales destacada (vigencia si aplica, o mensaje genérico).
  y += 6;
  doc.setFillColor(...tema.primarioRgb);
  doc.roundedRect(MARGEN_X, y, DERECHA - MARGEN_X, 9, 1.5, 1.5, 'F');
  doc.setTextColor(...tema.contrastePrimario);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const mensajeCondicion = datos.extra?.vigencia
    ? `Propuesta válida hasta el ${datos.extra.vigencia}`
    : 'Precios y disponibilidad sujetos a confirmación';
  doc.text(mensajeCondicion, MARGEN_X + 4, y + 6);
  y += 16;

  const c = datos.contraparte || {};
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...tema.primarioRgb);
  doc.text((c.etiqueta || 'Cliente').toUpperCase(), MARGEN_X, y);
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(60);
  doc.text(c.nombre || '', MARGEN_X, y);
  y += 5;
  const lineasContacto = [
    { tipo: 'telefono', texto: c.telefono },
    { tipo: 'correo', texto: c.correo },
  ].filter((l) => l.texto);
  lineasContacto.forEach((l) => {
    iconos[l.tipo](doc, MARGEN_X, y - 2.5, 3, tema.acento);
    doc.text(l.texto, MARGEN_X + 5.5, y);
    y += 4.5;
  });

  y += 4;
  const finalTablaY = dibujarTablaConceptos(doc, {
    startY: y,
    conceptos: datos.conceptos,
    colorEncabezado: tema.primarioRgb,
    fuente: 'helvetica',
  });

  // Total en caja grande, mucho más prominente que el resto de plantillas.
  let finalY = finalTablaY + 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(90);
  doc.text('Subtotal', DERECHA - 60, finalY);
  doc.text(formatoMonedaOpcional(datos.resumen.subtotal), DERECHA, finalY, { align: 'right' });
  finalY += 5.5;
  if (datos.resumen.descuentoTotal > 0) {
    doc.text('Descuento', DERECHA - 60, finalY);
    doc.text(`-${formatoMonedaOpcional(datos.resumen.descuentoTotal)}`, DERECHA, finalY, { align: 'right' });
    finalY += 5.5;
  }
  doc.text('Impuestos', DERECHA - 60, finalY);
  doc.text(formatoMonedaOpcional(datos.resumen.impuestos), DERECHA, finalY, { align: 'right' });
  finalY += 9;

  const altoCajaTotal = 18;
  doc.setFillColor(...tema.acentoRgb);
  doc.roundedRect(DERECHA - 78, finalY - 12, 78, altoCajaTotal, 2.5, 2.5, 'F');
  doc.setTextColor(...tema.contrasteAcento);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('TOTAL A PAGAR', DERECHA - 74, finalY - 4.5);
  doc.setFontSize(16);
  doc.text(formatoMonedaOpcional(datos.resumen.total), DERECHA - 4, finalY + 3, { align: 'right' });

  const finalResumenY = finalY + altoCajaTotal - 6;

  dibujarPiePagina(doc, {
    startY: finalResumenY + 10,
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
  coloresPorDefecto: { primario: '#0F172A', secundario: '#F59E0B', acento: '#DC2626' },
  render,
};
