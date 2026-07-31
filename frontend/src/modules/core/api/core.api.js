import api from '../../../shared/api';

export function registro(datos) {
  return api.post('/core/registro', datos).then((res) => res.data);
}

export function login(datos) {
  return api.post('/core/login', datos).then((res) => res.data);
}

export function me() {
  return api.get('/core/me').then((res) => res.data);
}
