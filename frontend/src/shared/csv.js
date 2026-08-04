// Export CSV 100% client-side (los datos del reporte ya están en memoria, no hace falta un
// endpoint nuevo) — mismo criterio de escapado que backend/src/shared/csv.js, para que un
// valor con coma/comilla/salto de línea no rompa el archivo al abrirlo en Excel/Sheets.
function escaparCampo(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  if (/[",\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

// filas: array de objetos; columnas: array de { clave, label }.
export function exportarCsv(nombreArchivo, filas, columnas) {
  const encabezado = columnas.map((c) => c.label).join(',');
  const lineas = filas.map((fila) => columnas.map((c) => escaparCampo(fila[c.clave])).join(','));
  const contenido = [encabezado, ...lineas].join('\n');

  const blobUrl = URL.createObjectURL(new Blob([`﻿${contenido}`], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = blobUrl;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(blobUrl);
}
