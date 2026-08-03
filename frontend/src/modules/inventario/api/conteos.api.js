import api from '../../../shared/api';

export function listarConteos(params) {
  return api.get('/inventario/conteos', { params }).then((res) => res.data);
}
export function obtenerConteo(id) {
  return api.get(`/inventario/conteos/${id}`).then((res) => res.data);
}
export function crearConteo(datos) {
  return api.post('/inventario/conteos', datos).then((res) => res.data);
}
export function reemplazarDetallesConteo(id, datos) {
  return api.put(`/inventario/conteos/${id}/detalles`, datos).then((res) => res.data);
}
export function cambiarEstadoConteo(id, datos) {
  return api.patch(`/inventario/conteos/${id}/estado`, datos).then((res) => res.data);
}
