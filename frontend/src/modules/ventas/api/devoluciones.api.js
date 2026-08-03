import api from '../../../shared/api';

export function listarDevoluciones(params) {
  return api.get('/ventas/devoluciones', { params }).then((res) => res.data);
}
export function crearDevolucion(datos) {
  return api.post('/ventas/devoluciones', datos).then((res) => res.data);
}
