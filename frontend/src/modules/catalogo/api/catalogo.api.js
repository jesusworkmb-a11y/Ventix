import api from '../../../shared/api';

export function listarArticulos(params) {
  return api.get('/catalogo/articulos', { params }).then((res) => res.data);
}
export function crearArticulo(datos) {
  return api.post('/catalogo/articulos', datos).then((res) => res.data);
}
export function actualizarArticulo(id, datos) {
  return api.patch(`/catalogo/articulos/${id}`, datos).then((res) => res.data);
}

export function listarCategorias() {
  return api.get('/catalogo/categorias').then((res) => res.data);
}
export function crearCategoria(datos) {
  return api.post('/catalogo/categorias', datos).then((res) => res.data);
}
export function actualizarCategoria(id, datos) {
  return api.patch(`/catalogo/categorias/${id}`, datos).then((res) => res.data);
}

export function listarMarcas() {
  return api.get('/catalogo/marcas').then((res) => res.data);
}
export function crearMarca(datos) {
  return api.post('/catalogo/marcas', datos).then((res) => res.data);
}
export function actualizarMarca(id, datos) {
  return api.patch(`/catalogo/marcas/${id}`, datos).then((res) => res.data);
}

export function listarUnidades() {
  return api.get('/catalogo/unidades').then((res) => res.data);
}
export function crearUnidad(datos) {
  return api.post('/catalogo/unidades', datos).then((res) => res.data);
}
export function actualizarUnidad(id, datos) {
  return api.patch(`/catalogo/unidades/${id}`, datos).then((res) => res.data);
}

export function listarImpuestos() {
  return api.get('/catalogo/impuestos').then((res) => res.data);
}
export function crearImpuesto(datos) {
  return api.post('/catalogo/impuestos', datos).then((res) => res.data);
}
export function actualizarImpuesto(id, datos) {
  return api.patch(`/catalogo/impuestos/${id}`, datos).then((res) => res.data);
}

export function listarListasPrecio() {
  return api.get('/catalogo/listas-precio').then((res) => res.data);
}
export function crearListaPrecio(datos) {
  return api.post('/catalogo/listas-precio', datos).then((res) => res.data);
}

export function actualizarPreciosArticulo(articuloId, precios) {
  return api.put(`/catalogo/articulos/${articuloId}/precios`, { precios }).then((res) => res.data);
}

export function listarDescuentos() {
  return api.get('/catalogo/descuentos').then((res) => res.data);
}
export function crearDescuento(datos) {
  return api.post('/catalogo/descuentos', datos).then((res) => res.data);
}
export function actualizarDescuento(id, datos) {
  return api.patch(`/catalogo/descuentos/${id}`, datos).then((res) => res.data);
}

export function listarPromociones() {
  return api.get('/catalogo/promociones').then((res) => res.data);
}
export function crearPromocion(datos) {
  return api.post('/catalogo/promociones', datos).then((res) => res.data);
}
export function actualizarPromocion(id, datos) {
  return api.patch(`/catalogo/promociones/${id}`, datos).then((res) => res.data);
}
