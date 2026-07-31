import api from '../../../shared/api';

export function listarArticulos(params) {
  return api.get('/catalogo/articulos', { params }).then((res) => res.data);
}
export function crearArticulo(datos) {
  return api.post('/catalogo/articulos', datos).then((res) => res.data);
}

export function listarCategorias() {
  return api.get('/catalogo/categorias').then((res) => res.data);
}
export function crearCategoria(datos) {
  return api.post('/catalogo/categorias', datos).then((res) => res.data);
}

export function listarMarcas() {
  return api.get('/catalogo/marcas').then((res) => res.data);
}
export function crearMarca(datos) {
  return api.post('/catalogo/marcas', datos).then((res) => res.data);
}

export function listarUnidades() {
  return api.get('/catalogo/unidades').then((res) => res.data);
}
export function crearUnidad(datos) {
  return api.post('/catalogo/unidades', datos).then((res) => res.data);
}

export function listarImpuestos() {
  return api.get('/catalogo/impuestos').then((res) => res.data);
}
export function crearImpuesto(datos) {
  return api.post('/catalogo/impuestos', datos).then((res) => res.data);
}
