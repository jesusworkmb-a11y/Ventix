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
export function obtenerArticulo(id) {
  return api.get(`/catalogo/articulos/${id}`).then((res) => res.data);
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

export function actualizarUnidadesAlternas(articuloId, unidadesAlternas) {
  return api.put(`/catalogo/articulos/${articuloId}/unidades-alternas`, { unidadesAlternas }).then((res) => res.data);
}

export function generarVariantesArticulo(articuloId, valorIds) {
  return api.put(`/catalogo/articulos/${articuloId}/variantes`, { valorIds }).then((res) => res.data);
}

export function actualizarKitDetalle(articuloId, componentes) {
  return api.put(`/catalogo/articulos/${articuloId}/kit`, { componentes }).then((res) => res.data);
}

export function listarAtributos() {
  return api.get('/catalogo/atributos').then((res) => res.data);
}
export function crearAtributo(datos) {
  return api.post('/catalogo/atributos', datos).then((res) => res.data);
}
export function actualizarAtributo(id, datos) {
  return api.patch(`/catalogo/atributos/${id}`, datos).then((res) => res.data);
}
export function eliminarAtributo(id) {
  return api.delete(`/catalogo/atributos/${id}`).then((res) => res.data);
}
export function agregarValorAtributo(atributoId, datos) {
  return api.post(`/catalogo/atributos/${atributoId}/valores`, datos).then((res) => res.data);
}
export function actualizarValorAtributo(valorId, datos) {
  return api.patch(`/catalogo/atributos/valores/${valorId}`, datos).then((res) => res.data);
}
export function eliminarValorAtributo(valorId) {
  return api.delete(`/catalogo/atributos/valores/${valorId}`).then((res) => res.data);
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
export function eliminarDescuento(id) {
  return api.delete(`/catalogo/descuentos/${id}`).then((res) => res.data);
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
export function eliminarPromocion(id) {
  return api.delete(`/catalogo/promociones/${id}`).then((res) => res.data);
}
