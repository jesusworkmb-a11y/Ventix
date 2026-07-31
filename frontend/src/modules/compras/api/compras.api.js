import api from '../../../shared/api';

export function listarCompras(params) {
  return api.get('/compras', { params }).then((res) => res.data);
}
export function crearCompra(datos) {
  return api.post('/compras', datos).then((res) => res.data);
}
