import api from '../../../shared/api';

export function listarExistencias(params) {
  return api.get('/inventario/existencias', { params }).then((res) => res.data);
}
export function establecerExistenciaInicial(datos) {
  return api.post('/inventario/existencias/inicial', datos).then((res) => res.data);
}

// Mismo criterio que Herramientas (shared/csv.js del backend, CSV plano que abre directo en
// Excel/Sheets) — respeta los mismos filtros que la pantalla tiene aplicados en ese momento,
// no un volcado completo aparte.
export async function exportarExistencias(params) {
  const res = await api.get('/inventario/existencias/exportar', { params, responseType: 'blob' });
  const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
  const enlace = document.createElement('a');
  enlace.href = blobUrl;
  enlace.download = 'existencias.csv';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(blobUrl);
}
