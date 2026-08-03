import api from '../../../shared/api';

export function listarCotizaciones(params) {
  return api.get('/ventas/cotizaciones', { params }).then((res) => res.data);
}
export function crearCotizacion(datos) {
  return api.post('/ventas/cotizaciones', datos).then((res) => res.data);
}
export function convertirCotizacion(id, datos) {
  return api.post(`/ventas/cotizaciones/${id}/convertir`, datos).then((res) => res.data);
}
