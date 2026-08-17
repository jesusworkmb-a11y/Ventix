import api from '../../../shared/api';

export function listarCsd() {
  return api.get('/facturacion/csd').then((res) => res.data);
}

export function registrarCsd(datos) {
  return api.post('/facturacion/csd', datos).then((res) => res.data);
}
