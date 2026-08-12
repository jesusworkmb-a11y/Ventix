import api from '../../../shared/api';

export function listarVentas(params) {
  return api.get('/ventas/ventas', { params }).then((res) => res.data);
}
export function obtenerVenta(id) {
  return api.get(`/ventas/ventas/${id}`).then((res) => res.data);
}
export function crearVenta(datos) {
  return api.post('/ventas/ventas', datos).then((res) => res.data);
}
export function cancelarVenta(id) {
  return api.patch(`/ventas/ventas/${id}/cancelar`).then((res) => res.data);
}
export function enviarTicketPorCorreo(id, datos) {
  return api.post(`/ventas/ventas/${id}/enviar-ticket`, datos).then((res) => res.data);
}
