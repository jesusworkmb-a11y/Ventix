import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarVentas, crearVenta } from '../api/ventas.api';
import { listarCajas, listarSesiones } from '../../caja/api/caja.api';
import { listarClientes } from '../../clientes/api/clientes.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';

function VentasPage() {
  const [cajas, setCajas] = useState([]);
  const [cajaId, setCajaId] = useState('');
  const [sesion, setSesion] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [articuloId, setArticuloId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [carrito, setCarrito] = useState([]);
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [error, setError] = useState('');
  const [confirmada, setConfirmada] = useState(null);
  const [ventas, setVentas] = useState([]);

  useEffect(() => {
    listarCajas()
      .then((data) => {
        setCajas(data);
        if (data.length) setCajaId((actual) => actual || data[0].id);
      })
      .catch(() => {});
    listarClientes()
      .then((data) => {
        setClientes(data);
        const general = data.find((c) => c.esGeneral);
        setClienteId((actual) => actual || (general ? general.id : ''));
      })
      .catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
    cargarVentas();
  }, []);

  useEffect(() => {
    if (cajaId) verificarSesion(cajaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cajaId]);

  function cargarVentas() {
    listarVentas().then(setVentas).catch(() => {});
  }

  async function verificarSesion(id) {
    try {
      const abiertas = await listarSesiones({ cajaId: id, abierta: 'true' });
      setSesion(abiertas[0] || null);
    } catch (err) {
      setSesion(null);
    }
  }

  function agregarLinea(e) {
    e.preventDefault();
    const articulo = articulos.find((a) => a.id === articuloId);
    if (!articulo) return;
    const impuestoTasa = articulo.impuesto ? Number(articulo.impuesto.tasa) : 0;
    setCarrito((c) => [
      ...c,
      {
        articuloId,
        nombre: articulo.nombre,
        cantidad: Number(cantidad),
        precio: Number(articulo.precio),
        impuestoTasa,
      },
    ]);
    setArticuloId('');
    setCantidad('1');
  }

  function quitarLinea(index) {
    setCarrito((c) => c.filter((_, i) => i !== index));
  }

  const subtotal = carrito.reduce((acc, l) => acc + l.cantidad * l.precio, 0);
  const impuestos = carrito.reduce((acc, l) => acc + l.cantidad * l.precio * l.impuestoTasa, 0);
  const total = Math.round((subtotal + impuestos) * 100) / 100;

  async function confirmarVenta(e) {
    e.preventDefault();
    setError('');
    setConfirmada(null);
    if (!sesion) {
      setError('No hay una sesión de caja abierta para esta caja.');
      return;
    }
    if (carrito.length === 0) {
      setError('Agrega al menos un artículo.');
      return;
    }
    const caja = cajas.find((c) => c.id === cajaId);
    try {
      const venta = await crearVenta({
        sucursalId: caja.sucursalId,
        clienteId,
        sesionCajaId: sesion.id,
        detalles: carrito.map((l) => ({ articuloId: l.articuloId, cantidad: l.cantidad })),
        pagos: [{ metodo: metodoPago, monto: total }],
      });
      setConfirmada(venta);
      setCarrito([]);
      cargarVentas();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la venta.');
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 700 }}>
      <p><Link to="/dashboard">← Volver al dashboard</Link></p>
      <h1>Ventas</h1>

      {cajas.length === 0 && <p>No hay cajas registradas todavía (créalas vía la API).</p>}

      {cajas.length > 0 && (
        <label>
          Caja
          <select value={cajaId} onChange={(e) => setCajaId(e.target.value)}>
            {cajas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
      )}

      {cajaId && !sesion && (
        <p>
          Esta caja no tiene una sesión abierta. <Link to="/caja">Abre una en Caja</Link> antes de vender.
        </p>
      )}

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {confirmada && (
        <div style={{ background: '#f0f0f0', padding: '1rem', margin: '1rem 0' }}>
          <p>Venta {confirmada.folio} registrada. Total: {confirmada.total}</p>
        </div>
      )}

      {sesion && (
        <>
          <label>
            Cliente
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}{c.esGeneral ? ' (general)' : ''}</option>
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
                <option key={a.id} value={a.id}>{a.nombre} (${a.precio})</option>
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
                <th style={{ textAlign: 'left' }}>Precio</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {carrito.map((l, i) => (
                <tr key={i}>
                  <td>{l.nombre}</td>
                  <td>{l.cantidad}</td>
                  <td>{l.precio}</td>
                  <td><button type="button" onClick={() => quitarLinea(i)}>Quitar</button></td>
                </tr>
              ))}
            </tbody>
          </table>

          <p>
            Subtotal: {subtotal.toFixed(2)} — Impuestos: {impuestos.toFixed(2)} — Total: {total.toFixed(2)}
          </p>

          <form onSubmit={confirmarVenta} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '2rem' }}>
            <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TARJETA">Tarjeta</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="MIXTO">Mixto</option>
            </select>
            <button type="submit">Confirmar venta</button>
          </form>
        </>
      )}

      <h2>Ventas recientes</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Folio</th>
            <th style={{ textAlign: 'left' }}>Cliente</th>
            <th style={{ textAlign: 'left' }}>Total</th>
            <th style={{ textAlign: 'left' }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {ventas.map((v) => (
            <tr key={v.id}>
              <td>{v.folio}</td>
              <td>{v.cliente?.nombre}</td>
              <td>{v.total}</td>
              <td>{v.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default VentasPage;
