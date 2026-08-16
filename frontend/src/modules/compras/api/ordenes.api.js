import api from '../../../shared/api';

export function listarOrdenesCompra(params) {
  return api.get('/compras/ordenes', { params }).then((res) => res.data);
}
export function obtenerOrdenCompra(id) {
  return api.get(`/compras/ordenes/${id}`).then((res) => res.data);
}
export function crearOrdenCompra(datos) {
  return api.post('/compras/ordenes', datos).then((res) => res.data);
}
export function cancelarOrdenCompra(id) {
  return api.patch(`/compras/ordenes/${id}/cancelar`).then((res) => res.data);
}
export function cerrarOrdenCompra(id) {
  return api.patch(`/compras/ordenes/${id}/cerrar`).then((res) => res.data);
}
export function enviarOrdenCompraPorCorreo(id, datos) {
  return api.post(`/compras/ordenes/${id}/enviar`, datos).then((res) => res.data);
}
