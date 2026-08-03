import api from '../../../shared/api';

export function listarAjustes(params) {
  return api.get('/inventario/ajustes', { params }).then((res) => res.data);
}
export function obtenerAjuste(id) {
  return api.get(`/inventario/ajustes/${id}`).then((res) => res.data);
}
export function crearAjuste(datos) {
  return api.post('/inventario/ajustes', datos).then((res) => res.data);
}
