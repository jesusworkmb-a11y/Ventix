import api from '../../../shared/api';

export function listarFacturas(params) {
  return api.get('/facturacion/facturas', { params }).then((res) => res.data);
}
export function obtenerFactura(id) {
  return api.get(`/facturacion/facturas/${id}`).then((res) => res.data);
}
export function listarVentasFacturables(params) {
  return api.get('/facturacion/facturas/ventas-facturables', { params }).then((res) => res.data);
}
export function obtenerSugerenciaFactura(params) {
  return api.get('/facturacion/facturas/sugerencia', { params }).then((res) => res.data);
}
export function crearFacturaDirecta(datos) {
  return api.post('/facturacion/facturas/directa', datos).then((res) => res.data);
}
export function crearFacturaDesdeVenta(datos) {
  return api.post('/facturacion/facturas/desde-venta', datos).then((res) => res.data);
}
export function crearFacturaAgrupada(datos) {
  return api.post('/facturacion/facturas/agrupada', datos).then((res) => res.data);
}
export function cancelarFactura(id, datos) {
  return api.patch(`/facturacion/facturas/${id}/cancelar`, datos).then((res) => res.data);
}
export function timbrarFactura(id) {
  return api.post(`/facturacion/facturas/${id}/timbrar`).then((res) => res.data);
}
