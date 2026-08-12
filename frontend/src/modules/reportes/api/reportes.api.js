import api from '../../../shared/api';

export function reporteVentas(params) {
  return api.get('/reportes/ventas', { params }).then((res) => res.data);
}
export function reporteArticulosMasVendidos(params) {
  return api.get('/reportes/articulos-mas-vendidos', { params }).then((res) => res.data);
}
export function reporteInventarioValorizado(params) {
  return api.get('/reportes/inventario-valorizado', { params }).then((res) => res.data);
}
export function reporteCompras(params) {
  return api.get('/reportes/compras', { params }).then((res) => res.data);
}
export function reporteCaja(params) {
  return api.get('/reportes/caja', { params }).then((res) => res.data);
}
export function enviarReportePorCorreo(datos) {
  return api.post('/reportes/enviar', datos).then((res) => res.data);
}
