import api from '../../../shared/api';

export function listarTransferencias(params) {
  return api.get('/inventario/transferencias', { params }).then((res) => res.data);
}
export function obtenerTransferencia(id) {
  return api.get(`/inventario/transferencias/${id}`).then((res) => res.data);
}
export function crearTransferencia(datos) {
  return api.post('/inventario/transferencias', datos).then((res) => res.data);
}
export function recibirTransferencia(id) {
  return api.patch(`/inventario/transferencias/${id}/recibir`).then((res) => res.data);
}
