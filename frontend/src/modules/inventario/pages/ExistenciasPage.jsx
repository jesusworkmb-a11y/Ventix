import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarExistencias, establecerExistenciaInicial } from '../api/inventario.api';
import { listarSucursales } from '../../core/api/core.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';

const FORM_VACIO = { sucursalId: '', articuloId: '', cantidad: '' };

function ExistenciasPage() {
  const [existencias, setExistencias] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');

  function cargarExistencias() {
    listarExistencias().then(setExistencias).catch(() => {});
  }

  useEffect(() => {
    cargarExistencias();
    listarSucursales().then(setSucursales).catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
  }, []);

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      await establecerExistenciaInicial({
        sucursalId: form.sucursalId,
        articuloId: form.articuloId,
        cantidad: Number(form.cantidad),
      });
      setForm(FORM_VACIO);
      cargarExistencias();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo establecer la existencia inicial.');
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 700 }}>
      <p><Link to="/dashboard">← Volver al dashboard</Link></p>
      <h1>Existencias</h1>
      <p>
        <Link to="/inventario/ajustes">Ver ajustes →</Link>{' '}
        <Link to="/inventario/transferencias">Ver transferencias →</Link>{' '}
        <Link to="/inventario/conteos">Ver conteos físicos →</Link>
      </p>

      {articulos.length === 0 && (
        <p>Primero da de alta artículos en el <Link to="/catalogo/articulos">catálogo</Link>.</p>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Sucursal</th>
            <th style={{ textAlign: 'left' }}>Artículo</th>
            <th style={{ textAlign: 'left' }}>SKU</th>
            <th style={{ textAlign: 'left' }}>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {existencias.map((e) => (
            <tr key={e.id}>
              <td>{e.sucursal?.nombre}</td>
              <td>{e.articulo?.nombre}</td>
              <td>{e.articulo?.sku || '—'}</td>
              <td>{e.cantidad}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Establecer existencia inicial</h2>
      <p style={{ color: '#555' }}>
        Solo para un artículo que todavía no tiene existencia registrada en esa sucursal.
        Para corregir una existencia ya en uso, usa un ajuste desde la API.
      </p>
      <form onSubmit={agregar} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 320 }}>
        <label>
          Sucursal
          <select value={form.sucursalId} onChange={(e) => actualizarCampo('sucursalId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </label>
        <label>
          Artículo
          <select value={form.articuloId} onChange={(e) => actualizarCampo('articuloId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {articulos.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        </label>
        <label>
          Cantidad
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.cantidad}
            onChange={(e) => actualizarCampo('cantidad', e.target.value)}
            required
          />
        </label>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit">Establecer existencia</button>
      </form>
    </div>
  );
}

export default ExistenciasPage;
