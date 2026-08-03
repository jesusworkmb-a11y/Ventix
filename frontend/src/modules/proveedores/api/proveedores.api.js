import api from '../../../shared/api';

export function listarProveedores(params) {
  return api.get('/proveedores', { params }).then((res) => res.data);
}
export function crearProveedor(datos) {
  return api.post('/proveedores', datos).then((res) => res.data);
}
export function actualizarProveedor(id, datos) {
  return api.patch(`/proveedores/${id}`, datos).then((res) => res.data);
}
