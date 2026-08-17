// §Plantillas de documentos: resuelve la paleta de colores efectiva de un documento — la de
// la empresa si la personalizó, si no la que trae por defecto la plantilla elegida (cada
// plantilla en plantillas/*.js define coloresPorDefecto para verse bien "de fábrica").

export function hexToRgb(hex) {
  const limpio = (hex || '').replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(limpio)) return [15, 23, 42];
  const num = parseInt(limpio, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// Elige texto blanco o casi negro según la luminancia del fondo, para que los bloques de
// color (bandas, cajas de total) sigan siendo legibles sin importar el color elegido.
export function colorContraste(hex) {
  const [r, g, b] = hexToRgb(hex);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? [17, 24, 39] : [255, 255, 255];
}

export function resolverTema(empresa, coloresPorDefecto = {}) {
  const primario = empresa?.colorPrimario || coloresPorDefecto.primario || '#0F172A';
  const secundario = empresa?.colorSecundario || coloresPorDefecto.secundario || '#64748B';
  const acento = empresa?.colorAcento || coloresPorDefecto.acento || '#2563EB';
  return {
    primario,
    secundario,
    acento,
    primarioRgb: hexToRgb(primario),
    secundarioRgb: hexToRgb(secundario),
    acentoRgb: hexToRgb(acento),
    contrastePrimario: colorContraste(primario),
    contrasteAcento: colorContraste(acento),
  };
}
