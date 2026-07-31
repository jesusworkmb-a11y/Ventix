import api from '../../../shared/api';

export function listarClientes(params) {
  return api.get('/clientes', { params }).then((res) => res.data);
}
export function crearCliente(datos) {
  return api.post('/clientes', datos).then((res) => res.data);
}
