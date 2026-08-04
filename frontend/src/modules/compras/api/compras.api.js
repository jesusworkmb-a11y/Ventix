import api from '../../../shared/api';

export function listarCompras(params) {
  return api.get('/compras', { params }).then((res) => res.data);
}
export function obtenerCompra(id) {
  return api.get(`/compras/${id}`).then((res) => res.data);
}
export function crearCompra(datos) {
  return api.post('/compras', datos).then((res) => res.data);
}
export function cancelarCompra(id) {
  return api.patch(`/compras/${id}/cancelar`).then((res) => res.data);
}
