import api from '../../../shared/api';

export async function buscarCatalogoSat(tipo, q, limite = 20) {
  const { data } = await api.get('/facturacion/catalogos-sat', { params: { tipo, q, limite } });
  return data;
}
