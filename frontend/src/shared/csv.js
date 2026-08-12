// Export CSV 100% client-side (los datos del reporte ya están en memoria, no hace falta un
// endpoint nuevo) — mismo criterio de escapado que backend/src/shared/csv.js, para que un
// valor con coma/comilla/salto de línea no rompa el archivo al abrirlo en Excel/Sheets.
// Un valor que empiece con =, +, - o @ se interpreta como fórmula al abrir el CSV en Excel/
// Sheets (CWE-1236) -- mismo criterio que backend/src/shared/csv.js: se neutraliza anteponiendo
// un apóstrofe para que nombres de artículo/proveedor con esos caracteres no se ejecuten solos.
function neutralizarFormula(texto) {
  return /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
}

function escaparCampo(valor) {
  const texto = neutralizarFormula(valor === null || valor === undefined ? '' : String(valor));
  if (/[",\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

// filas: array de objetos; columnas: array de { clave, label }. Separado de exportarCsv para
// poder reusar el mismo contenido tanto para la descarga como para el envío por correo (ver
// enviarReportePorCorreo en reportes.api.js), sin duplicar el escapado.
export function construirCsv(filas, columnas) {
  const encabezado = columnas.map((c) => c.label).join(',');
  const lineas = filas.map((fila) => columnas.map((c) => escaparCampo(fila[c.clave])).join(','));
  return [encabezado, ...lineas].join('\n');
}

export function exportarCsv(nombreArchivo, filas, columnas) {
  const contenido = construirCsv(filas, columnas);

  const blobUrl = URL.createObjectURL(new Blob([`﻿${contenido}`], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = blobUrl;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(blobUrl);
}
