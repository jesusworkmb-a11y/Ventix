// Helper CSV mínimo, sin dependencias externas — pensado para catálogos que se editan en
// Excel/Sheets, no para datos con campos multilínea entre comillas.

function escaparCampo(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  if (/[",\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

// filas: array de objetos; columnas: array de claves a incluir, en orden.
function aCsv(filas, columnas) {
  const encabezado = columnas.join(',');
  const lineas = filas.map((fila) => columnas.map((col) => escaparCampo(fila[col])).join(','));
  return [encabezado, ...lineas].join('\n');
}

// Parser simple con soporte de comillas para comas/comillas escapadas dentro de un renglón
// (sin soporte de saltos de línea dentro de un campo entre comillas).
function parsearLinea(linea) {
  const campos = [];
  let actual = '';
  let entreComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const char = linea[i];
    if (entreComillas) {
      if (char === '"' && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else if (char === '"') {
        entreComillas = false;
      } else {
        actual += char;
      }
    } else if (char === '"') {
      entreComillas = true;
    } else if (char === ',') {
      campos.push(actual);
      actual = '';
    } else {
      actual += char;
    }
  }
  campos.push(actual);
  return campos;
}

// Devuelve un array de objetos {columna: valor}, usando la primera línea como encabezado.
function parsearCsv(texto) {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lineas.length === 0) return [];

  const encabezado = parsearLinea(lineas[0]).map((c) => c.trim());
  return lineas.slice(1).map((linea) => {
    const valores = parsearLinea(linea);
    const fila = {};
    encabezado.forEach((col, i) => {
      fila[col] = (valores[i] || '').trim();
    });
    return fila;
  });
}

module.exports = { aCsv, parsearCsv };
