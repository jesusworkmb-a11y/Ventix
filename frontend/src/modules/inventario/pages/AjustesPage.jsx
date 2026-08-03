import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarAjustes, obtenerAjuste, crearAjuste } from '../api/ajustes.api';
import { listarSucursales } from '../../core/api/core.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';
import { listarUsuarios } from '../../core/api/core.api';

function AjustesPage() {
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [articuloId, setArticuloId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [motivo, setMotivo] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [autorizadoPorId, setAutorizadoPorId] = useState('');
  const [error, setError] = useState('');
  const [creado, setCreado] = useState(null);
  const [ajustes, setAjustes] = useState([]);

  const [verDetalleId, setVerDetalleId] = useState(null);
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    listarSucursales()
      .then((data) => {
        setSucursales(data);
        if (data.length) setSucursalId((actual) => actual || data[0].id);
      })
      .catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
    listarUsuarios().then(setUsuarios).catch(() => {});
    cargarAjustes();
  }, []);

  function cargarAjustes() {
    listarAjustes().then(setAjustes).catch(() => {});
  }

  function agregarLinea(e) {
    e.preventDefault();
    const articulo = articulos.find((a) => a.id === articuloId);
    if (!articulo) return;
    const cant = Number(cantidad);
    if (!cant) {
      setError('La cantidad no puede ser 0.');
      return;
    }
    setError('');
    setCarrito((c) => [...c, { articuloId, nombre: articulo.nombre, cantidad: cant }]);
    setArticuloId('');
    setCantidad('');
  }

  function quitarLinea(index) {
    setCarrito((c) => c.filter((_, i) => i !== index));
  }

  async function confirmarAjuste(e) {
    e.preventDefault();
    setError('');
    setCreado(null);
    if (carrito.length === 0) {
      setError('Agrega al menos un artículo.');
      return;
    }
    try {
      const ajuste = await crearAjuste({
        sucursalId,
        motivo,
        autorizadoPorId: autorizadoPorId || undefined,
        detalles: carrito.map((l) => ({ articuloId: l.articuloId, cantidad: l.cantidad })),
      });
      setCreado(ajuste);
      setCarrito([]);
      setMotivo('');
      cargarAjustes();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar el ajuste.');
    }
  }

  async function verDetalle(id) {
    setVerDetalleId(id);
    setDetalle(null);
    try {
      const d = await obtenerAjuste(id);
      setDetalle(d);
    } catch (err) {
      setDetalle(null);
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 700 }}>
      <p><Link to="/inventario/existencias">← Volver a Existencias</Link></p>
      <h1>Ajustes de inventario</h1>
      <p>
        <Link to="/inventario/transferencias">Ver transferencias →</Link>{' '}
        <Link to="/inventario/conteos">Ver conteos físicos →</Link>
      </p>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {creado && (
        <div style={{ background: '#f0f0f0', padding: '1rem', margin: '1rem 0' }}>
          <p>Ajuste {creado.folio} registrado.</p>
        </div>
      )}

      <h2>Nuevo ajuste</h2>
      <label>
        Sucursal
        <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
          {sucursales.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </label>
      <br />
      <label>
        Motivo
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} required style={{ marginLeft: '0.5rem' }} />
      </label>

      <form
        onSubmit={agregarLinea}
        style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '1rem 0', flexWrap: 'wrap' }}
      >
        <select value={articuloId} onChange={(e) => setArticuloId(e.target.value)} required>
          <option value="">Artículo...</option>
          {articulos.map((a) => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          placeholder="Cantidad (+ entra, - sale)"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          style={{ width: '160px' }}
          required
        />
        <button type="submit">Agregar</button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Artículo</th>
            <th style={{ textAlign: 'left' }}>Cantidad</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {carrito.map((l, i) => (
            <tr key={i}>
              <td>{l.nombre}</td>
              <td>{l.cantidad > 0 ? `+${l.cantidad}` : l.cantidad}</td>
              <td><button type="button" onClick={() => quitarLinea(i)}>Quitar</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <label>
        Autoriza (opcional)
        <select value={autorizadoPorId} onChange={(e) => setAutorizadoPorId(e.target.value)} style={{ marginLeft: '0.5rem' }}>
          <option value="">—</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>{u.nombre}</option>
          ))}
        </select>
      </label>

      <form onSubmit={confirmarAjuste} style={{ marginTop: '1rem', marginBottom: '2rem' }}>
        <button type="submit">Registrar ajuste</button>
      </form>

      <h2>Ajustes recientes</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Folio</th>
            <th style={{ textAlign: 'left' }}>Motivo</th>
            <th style={{ textAlign: 'left' }}>Fecha</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {ajustes.map((a) => (
            <Fragment key={a.id}>
              <tr>
                <td>{a.folio}</td>
                <td>{a.motivo}</td>
                <td>{new Date(a.creadoEn).toLocaleString()}</td>
                <td><button type="button" onClick={() => verDetalle(a.id)}>Ver líneas</button></td>
              </tr>
              {verDetalleId === a.id && (
                <tr>
                  <td colSpan={4} style={{ background: '#f7f7f7', padding: '1rem' }}>
                    {!detalle && <p>Cargando…</p>}
                    {detalle && (
                      <ul>
                        {detalle.detalles.map((d) => (
                          <li key={d.id}>
                            {d.articulo?.nombre || d.articuloId}: {Number(d.cantidad) > 0 ? '+' : ''}{d.cantidad}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AjustesPage;
