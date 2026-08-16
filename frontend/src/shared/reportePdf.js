import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const MARGEN_X = 15;
const ANCHO_PAGINA = 210;
const DERECHA = ANCHO_PAGINA - MARGEN_X;
const ALTO_LOGO = 14; // mm — ancho se deriva de la proporción real de la imagen

// PDF tabular genérico para el módulo de Reportes -- mismo patrón de encabezado (logo + nombre
// de empresa) que cotizacionPdf.js, pero reusable por cualquier reporte en vez de un documento
// fijo: recibe columnas/filas ya resueltas (las mismas que arma cada Card de ReportesPage.jsx
// para CSV/Excel/correo) en vez de conocer la forma de cada reporte.
export function generarPdfReporte({
  titulo, subtitulo, columnas, filas, empresa,
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  let y = 18;
  let xTexto = MARGEN_X;

  // Un logo corrupto o en un formato que jsPDF no pueda leer no debe tumbar la generación del
  // PDF (mismo criterio que cotizacionPdf.js).
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

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text(empresa?.nombreComercial || '', xTexto, y);
  doc.setFontSize(13);
  doc.text(titulo, DERECHA, y, { align: 'right' });

  y += 6;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  if (subtitulo) doc.text(subtitulo, xTexto, y);
  doc.text(`Generado: ${new Date().toLocaleString()}`, DERECHA, y, { align: 'right' });

  y += 5;
  doc.setDrawColor(210);
  doc.line(MARGEN_X, y, DERECHA, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [columnas.map((c) => c.label)],
    body: filas.map((fila) => columnas.map((c) => {
      const valor = fila[c.clave];
      return valor === null || valor === undefined ? '' : String(valor);
    })),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42] },
    margin: { left: MARGEN_X, right: MARGEN_X },
  });

  if (filas.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(140);
    doc.text('Sin resultados.', MARGEN_X, doc.lastAutoTable.finalY + 8);
  }

  return doc;
}

export async function descargarPdfReporte(opciones, nombreArchivo) {
  const doc = generarPdfReporte(opciones);
  doc.save(nombreArchivo);
}
