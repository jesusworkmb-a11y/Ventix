import api from '../../../shared/api';

async function descargarCsv(url, nombreArchivo) {
  const res = await api.get(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
  const enlace = document.createElement('a');
  enlace.href = blobUrl;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(blobUrl);
}

export function exportarArticulos() {
  return descargarCsv('/herramientas/articulos/exportar', 'articulos.csv');
}
export function exportarClientes() {
  return descargarCsv('/herramientas/clientes/exportar', 'clientes.csv');
}
export function exportarProveedores() {
  return descargarCsv('/herramientas/proveedores/exportar', 'proveedores.csv');
}

export function importarArticulos(csv) {
  return api.post('/herramientas/articulos/importar', { csv }).then((res) => res.data);
}
