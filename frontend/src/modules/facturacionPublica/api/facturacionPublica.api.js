import api from '../../../shared/api';

// Portal público de autofacturación (Fase E) -- estos endpoints no llevan Authorization (el
// interceptor de `api` solo agrega el header si hay un token en localStorage, así que un
// visitante sin sesión los llama igual sin romper nada).

export async function obtenerEmpresaPublica(slug) {
  const { data } = await api.get(`/facturacion/portal-publico/${slug}`);
  return data;
}

export async function buscarVentaPublica(slug, { folio, total }) {
  const { data } = await api.post(`/facturacion/portal-publico/${slug}/buscar-venta`, { folio, total });
  return data;
}

export async function facturarPublico(slug, { folio, total, receptor }) {
  const { data } = await api.post(`/facturacion/portal-publico/${slug}/facturar`, { folio, total, receptor });
  return data;
}

export async function buscarCatalogoSatPublico(tipo, q, limite = 20) {
  const { data } = await api.get('/facturacion/portal-publico/catalogos-sat', { params: { tipo, q, limite } });
  return data;
}
