import api from '../../../shared/api';

export function listarPlantillas(params) {
  return api.get('/facturacion/plantillas', { params }).then((res) => res.data);
}
export function crearPlantilla(datos) {
  return api.post('/facturacion/plantillas', datos).then((res) => res.data);
}
export function actualizarPlantilla(id, datos) {
  return api.patch(`/facturacion/plantillas/${id}`, datos).then((res) => res.data);
}
export function eliminarPlantilla(id) {
  return api.delete(`/facturacion/plantillas/${id}`).then((res) => res.data);
}
export function registrarUsoPlantilla(id) {
  return api.post(`/facturacion/plantillas/${id}/registrar-uso`).then((res) => res.data);
}
