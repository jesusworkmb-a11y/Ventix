import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarTransferencias, obtenerTransferencia, crearTransferencia, recibirTransferencia } from '../api/transferencias.api';
import { listarSucursales } from '../../core/api/core.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';

function TransferenciasPage() {
  const [sucursales, setSucursales] = useState([]);
  const [sucursalOrigenId, setSucursalOrigenId] = useState('');
  const [sucursalDestinoId, setSucursalDestinoId] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [articuloId, setArticuloId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [carrito, setCarrito] = useState([]);
  const [error, setError] = useState('');
  const [creada, setCreada] = useState(null);
  const [transferencias, setTransferencias] = useState([]);

  const [verDetalleId, setVerDetalleId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [recibirError, setRecibirError] = useState('');

  useEffect(() => {
    listarSucursales()
      .then((data) => {
        setSucursales(data);
        if (data.length) {
          setSucursalOrigenId((actual) => actual || data[0].id);
          setSucursalDestinoId((actual) => actual || (data[1]?.id || data[0].id));
        }
      })
      .catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
    cargarTransferencias();
  }, []);

  function cargarTransferencias() {
    listarTransferencias().then(setTransferencias).catch(() => {});
  }

  function nombreSucursal(id) {
    return sucursales.find((s) => s.id === id)?.nombre || id;
  }

  function agregarLinea(e) {
    e.preventDefault();
    const articulo = articulos.find((a) => a.id === articuloId);
    if (!articulo) return;
    setCarrito((c) => [...c, { articuloId, nombre: articulo.nombre, cantidad: Number(cantidad) }]);
    setArticuloId('');
    setCantidad('1');
  }

  function quitarLinea(index) {
    setCarrito((c) => c.filter((_, i) => i !== index));
  }

  async function confirmarTransferencia(e) {
    e.preventDefault();
    setError('');
    setCreada(null);
    if (sucursalOrigenId === sucursalDestinoId) {
      setError('La sucursal de origen y destino deben ser distintas.');
      return;
    }
    if (carrito.length === 0) {
      setError('Agrega al menos un artículo.');
      return;
    }
    try {
      const transferencia = await crearTransferencia({
        sucursalOrigenId,
        sucursalDestinoId,
        detalles: carrito.map((l) => ({ articuloId: l.articuloId, cantidad: l.cantidad })),
      });
      setCreada(transferencia);
      setCarrito([]);
      cargarTransferencias();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la transferencia.');
    }
  }

  async function verDetalle(id) {
    setVerDetalleId(id);
    setDetalle(null);
    setRecibirError('');
    try {
      const d = await obtenerTransferencia(id);
      setDetalle(d);
    } catch (err) {
      setDetalle(null);
    }
  }

  async function handleRecibir(id) {
    setRecibirError('');
    try {
      await recibirTransferencia(id);
      cargarTransferencias();
      if (verDetalleId === id) verDetalle(id);
    } catch (err) {
      setRecibirError(err.response?.data?.error || 'No se pudo recibir la transferencia.');
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 700 }}>
      <p><Link to="/inventario/existencias">← Volver a Existencias</Link></p>
      <h1>Transferencias entre sucursales</h1>
      <p>
        <Link to="/inventario/ajustes">Ver ajustes →</Link>{' '}
        <Link to="/inventario/conteos">Ver conteos físicos →</Link>
      </p>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {creada && (
        <div style={{ background: '#f0f0f0', padding: '1rem', margin: '1rem 0' }}>
          <p>Transferencia {creada.folio} creada — en tránsito.</p>
        </div>
      )}

      <h2>Nueva transferencia</h2>
      <label>
        Origen
        <select value={sucursalOrigenId} onChange={(e) => setSucursalOrigenId(e.target.value)}>
          {sucursales.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </label>{' '}
      <label>
        Destino
        <select value={sucursalDestinoId} onChange={(e) => setSucursalDestinoId(e.target.value)}>
          {sucursales.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
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
          min="0.01"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          style={{ width: '80px' }}
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
              <td>{l.cantidad}</td>
              <td><button type="button" onClick={() => quitarLinea(i)}>Quitar</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={confirmarTransferencia} style={{ marginBottom: '2rem' }}>
        <button type="submit">Crear transferencia</button>
      </form>

      <h2>Transferencias recientes</h2>
      {recibirError && <p style={{ color: 'crimson' }}>{recibirError}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Folio</th>
            <th style={{ textAlign: 'left' }}>Origen → Destino</th>
            <th style={{ textAlign: 'left' }}>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {transferencias.map((t) => (
            <Fragment key={t.id}>
              <tr>
                <td>{t.folio}</td>
                <td>{nombreSucursal(t.sucursalOrigenId)} → {nombreSucursal(t.sucursalDestinoId)}</td>
                <td>{t.estado}</td>
                <td>
                  <button type="button" onClick={() => verDetalle(t.id)}>Ver líneas</button>{' '}
                  {t.estado === 'EN_TRANSITO' && (
                    <button type="button" onClick={() => handleRecibir(t.id)}>Recibir</button>
                  )}
                </td>
              </tr>
              {verDetalleId === t.id && (
                <tr>
                  <td colSpan={4} style={{ background: '#f7f7f7', padding: '1rem' }}>
                    {!detalle && <p>Cargando…</p>}
                    {detalle && (
                      <ul>
                        {detalle.detalles.map((d) => (
                          <li key={d.id}>{d.articulo?.nombre || d.articuloId}: {d.cantidad}</li>
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

export default TransferenciasPage;
