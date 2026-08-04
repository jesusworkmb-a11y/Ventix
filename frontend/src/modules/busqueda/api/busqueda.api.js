import api from '../../../shared/api';

export function buscarGlobal(q) {
  return api.get('/busqueda', { params: { q } }).then((res) => res.data);
}
