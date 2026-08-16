// Excel real (.xlsx) 100% client-side, mismo criterio que csv.js: los datos del reporte ya
// están en memoria, no hace falta un endpoint nuevo. exceljs se importa dinámicamente -- pesa
// bastante, mismo criterio ya usado para jsPDF en cotizacionPdf.js -- para no ir en el bundle
// inicial de toda la app.
export async function exportarExcel(nombreArchivo, filas, columnas) {
  const ExcelJS = (await import('exceljs')).default;
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Reporte');
  hoja.columns = columnas.map((c) => ({
    header: c.label, key: c.clave, width: Math.max(c.label.length + 4, 12),
  }));
  hoja.getRow(1).font = { bold: true };
  filas.forEach((fila) => hoja.addRow(fila));

  const buffer = await libro.xlsx.writeBuffer();
  const blobUrl = URL.createObjectURL(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const enlace = document.createElement('a');
  enlace.href = blobUrl;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(blobUrl);
}
