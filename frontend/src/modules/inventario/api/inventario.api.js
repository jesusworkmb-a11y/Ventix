import api from '../../../shared/api';

export function listarExistencias(params) {
  return api.get('/inventario/existencias', { params }).then((res) => res.data);
}
export function establecerExistenciaInicial(datos) {
  return api.post('/inventario/existencias/inicial', datos).then((res) => res.data);
}
