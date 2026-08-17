import { jsPDF } from 'jspdf';
import { formatoFecha, formatoMoneda } from '../../format';
import {
  MARGEN_X, DERECHA, dibujarLogo, dibujarResumenFinanciero,
  dibujarPiePagina, dibujarInsigniaEstatus,
} from '../componentes';

const ALTO_LOGO = 14;
const ALTO_TARJETA = 22;
const ALTO_PAGINA_UTIL = 272; // mm — margen inferior de seguridad en carta (279.4mm)

// Plantilla 5 — Visual con Productos: tarjetas por línea con miniatura del artículo (si tiene
// `imagenUrl`) en vez de una tabla tradicional — estilo catálogo/e-commerce. Una línea sin
// imagen cae a una tarjeta compacta sin imagen, sin romper el layout.
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
  doc.setFontSize(13);
  doc.setTextColor(...tema.primarioRgb);
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
  if (datosEmpresa) doc.text(datosEmpresa, xTexto, y, { maxWidth: DERECHA - xTexto - 50 });
  doc.text(`Folio: ${datos.folio || '-'}  ·  ${formatoFecha(datos.fecha)}`, DERECHA, y, { align: 'right' });
  if (datos.estatus) {
    y += 6;
    dibujarInsigniaEstatus(doc, { x: DERECHA, y, texto: datos.estatus.texto, tono: datos.estatus.tono, fuente: 'helvetica' });
  }

  y += 7;
  const c = datos.contraparte || {};
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...tema.primarioRgb);
  doc.text((c.etiqueta || 'Cliente').toUpperCase() + (c.nombre ? `: ${c.nombre}` : ''), MARGEN_X, y);
  y += 6;
  doc.setDrawColor(225);
  doc.line(MARGEN_X, y, DERECHA, y);
  y += 7;

  datos.conceptos.forEach((concepto) => {
    if (y + ALTO_TARJETA > ALTO_PAGINA_UTIL) {
      doc.addPage();
      y = 18;
    }
    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(230);
    doc.roundedRect(MARGEN_X, y, DERECHA - MARGEN_X, ALTO_TARJETA, 2, 2, 'FD');

    const tamImagen = ALTO_TARJETA - 6;
    const xImagen = MARGEN_X + 3;
    let dibujoOk = false;
    if (concepto.imagenUrl) {
      try {
        // Articulo.imagenUrl viaja como data URI PNG, mismo criterio que Empresa.logoUrl
        // (ver frontend/src/shared/imagen.js#redimensionarImagen, reusado por ambos).
        doc.addImage(concepto.imagenUrl, 'PNG', xImagen, y + 3, tamImagen, tamImagen);
        dibujoOk = true;
      } catch (err) {
        dibujoOk = false;
      }
    }
    if (!dibujoOk) {
      doc.setFillColor(...tema.acentoRgb);
      doc.roundedRect(xImagen, y + 3, tamImagen, tamImagen, 1.5, 1.5, 'F');
      doc.setTextColor(...tema.contrasteAcento);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text((concepto.descripcion || '?').slice(0, 1).toUpperCase(), xImagen + tamImagen / 2, y + 3 + tamImagen / 2 + 1.5, { align: 'center' });
    }

    const xTextoTarjeta = xImagen + tamImagen + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(25);
    doc.text(concepto.descripcion || '', xTextoTarjeta, y + 8, { maxWidth: DERECHA - xTextoTarjeta - 32 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    const meta = [concepto.codigo && `Cód. ${concepto.codigo}`, `${concepto.cantidad} ${concepto.unidad || 'pza'} × ${formatoMoneda(concepto.precioUnitario)}`]
      .filter(Boolean).join('   ·   ');
    doc.text(meta, xTextoTarjeta, y + 14, { maxWidth: DERECHA - xTextoTarjeta - 32 });
    if (concepto.descuento > 0) {
      doc.setTextColor(...tema.acentoRgb);
      doc.text(`Descuento: -${formatoMoneda(concepto.descuento)}`, xTextoTarjeta, y + 19);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(formatoMoneda(concepto.importe), DERECHA - 3, y + ALTO_TARJETA / 2 + 2, { align: 'right' });

    y += ALTO_TARJETA + 4;
  });

  if (y + 40 > ALTO_PAGINA_UTIL) { doc.addPage(); y = 18; }
  y += 4;
  const finalResumenY = dibujarResumenFinanciero(doc, {
    startY: y,
    resumen: datos.resumen,
    fuente: 'helvetica',
    cajaTotal: true,
    colorTotalRgb: tema.primarioRgb,
    contrasteTotalRgb: tema.contrastePrimario,
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
  coloresPorDefecto: { primario: '#0F172A', secundario: '#8B5CF6', acento: '#7C3AED' },
  render,
};
