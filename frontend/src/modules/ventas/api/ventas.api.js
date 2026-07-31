import api from '../../../shared/api';

export function listarVentas(params) {
  return api.get('/ventas/ventas', { params }).then((res) => res.data);
}
export function crearVenta(datos) {
  return api.post('/ventas/ventas', datos).then((res) => res.data);
}
