import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarCompras, crearCompra, cancelarCompra } from '../api/compras.api';
import { listarProveedores } from '../../proveedores/api/proveedores.api';
import { listarSucursales } from '../../core/api/core.api';
import { listarArticulos, listarUnidades } from '../../catalogo/api/catalogo.api';

const FORM_VACIO = {
  proveedorId: '',
  sucursalId: '',
  articuloId: '',
  unidadId: '',
  cantidad: '',
  costo: '',
};

function ComprasPage() {
  const [compras, setCompras] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');

  function cargarCompras() {
    listarCompras().then(setCompras).catch(() => {});
  }

  useEffect(() => {
    cargarCompras();
    listarProveedores().then(setProveedores).catch(() => {});
    listarSucursales().then(setSucursales).catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
    listarUnidades().then(setUnidades).catch(() => {});
  }, []);

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function handleCancelar(compraId) {
    setError('');
    try {
      await cancelarCompra(compraId);
      cargarCompras();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cancelar la compra.');
    }
  }

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      await crearCompra({
        proveedorId: form.proveedorId,
        sucursalId: form.sucursalId,
        detalles: [
          {
            articuloId: form.articuloId,
            unidadId: form.unidadId,
            cantidad: Number(form.cantidad),
            costo: Number(form.costo),
          },
        ],
      });
      setForm(FORM_VACIO);
      cargarCompras();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la compra.');
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 700 }}>
      <p><Link to="/dashboard">← Volver al dashboard</Link></p>
      <h1>Compras</h1>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Folio</th>
            <th style={{ textAlign: 'left' }}>Proveedor</th>
            <th style={{ textAlign: 'left' }}>Sucursal</th>
            <th style={{ textAlign: 'left' }}>Total</th>
            <th style={{ textAlign: 'left' }}>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {compras.map((c) => (
            <tr key={c.id}>
              <td>{c.folio}</td>
              <td>{c.proveedor?.nombre}</td>
              <td>{c.sucursal?.nombre}</td>
              <td>{c.total}</td>
              <td>{c.estado}</td>
              <td>
                {c.estado === 'CONFIRMADA' && (
                  <button type="button" onClick={() => handleCancelar(c.id)}>Cancelar</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Nueva compra</h2>
      <p style={{ color: '#555' }}>Una línea por compra desde aquí. Para varias líneas, usa la API.</p>
      <form onSubmit={agregar} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 320 }}>
        <label>
          Proveedor
          <select value={form.proveedorId} onChange={(e) => actualizarCampo('proveedorId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {proveedores.filter((p) => p.activo).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </label>
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
          Unidad
          <select value={form.unidadId} onChange={(e) => actualizarCampo('unidadId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
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
        <label>
          Costo por unidad
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.costo}
            onChange={(e) => actualizarCampo('costo', e.target.value)}
            required
          />
        </label>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit">Registrar compra</button>
      </form>
    </div>
  );
}

export default ComprasPage;
