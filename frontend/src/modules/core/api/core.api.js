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

export function actualizarEmpresa(datos) {
  return api.patch('/core/empresa', datos).then((res) => res.data);
}

export function listarSucursales() {
  return api.get('/core/sucursales').then((res) => res.data);
}
export function crearSucursal(datos) {
  return api.post('/core/sucursales', datos).then((res) => res.data);
}
export function actualizarSucursal(id, datos) {
  return api.patch(`/core/sucursales/${id}`, datos).then((res) => res.data);
}

export function listarUsuarios(params) {
  return api.get('/core/usuarios', { params }).then((res) => res.data);
}
export function crearUsuario(datos) {
  return api.post('/core/usuarios', datos).then((res) => res.data);
}
export function actualizarUsuario(id, datos) {
  return api.patch(`/core/usuarios/${id}`, datos).then((res) => res.data);
}

export function listarRoles() {
  return api.get('/core/roles').then((res) => res.data);
}
export function crearRol(datos) {
  return api.post('/core/roles', datos).then((res) => res.data);
}
export function actualizarRol(id, datos) {
  return api.patch(`/core/roles/${id}`, datos).then((res) => res.data);
}
export function reemplazarPermisosRol(id, claves) {
  return api.put(`/core/roles/${id}/permisos`, { claves }).then((res) => res.data);
}

export function listarPermisos() {
  return api.get('/core/permisos').then((res) => res.data);
}

export function listarAuditoria(filtros) {
  return api.get('/core/auditoria', { params: filtros }).then((res) => res.data);
}
