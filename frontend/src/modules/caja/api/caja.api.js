import api from '../../../shared/api';

export function listarCajas(params) {
  return api.get('/caja/cajas', { params }).then((res) => res.data);
}

export function listarSesiones(params) {
  return api.get('/caja/sesiones', { params }).then((res) => res.data);
}
export function obtenerSesion(id) {
  return api.get(`/caja/sesiones/${id}`).then((res) => res.data);
}
export function abrirSesion(datos) {
  return api.post('/caja/sesiones', datos).then((res) => res.data);
}
export function cerrarSesion(id, datos) {
  return api.patch(`/caja/sesiones/${id}/cerrar`, datos).then((res) => res.data);
}
export function registrarMovimiento(id, datos) {
  return api.post(`/caja/sesiones/${id}/movimientos`, datos).then((res) => res.data);
}
