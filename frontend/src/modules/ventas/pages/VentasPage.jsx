import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarVentas, crearVenta, cancelarVenta, obtenerVenta } from '../api/ventas.api';
import { crearDevolucion } from '../api/devoluciones.api';
import { listarCajas, listarSesiones } from '../../caja/api/caja.api';
import { listarClientes } from '../../clientes/api/clientes.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';
import { listarUsuarios } from '../../core/api/core.api';

const MOTIVOS_DEVOLUCION = ['Producto defectuoso', 'Error de venta', 'Cliente cambió de opinión', 'Garantía', 'Otro'];

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
  const [usuarios, setUsuarios] = useState([]);

  const [devolviendoId, setDevolviendoId] = useState(null);
  const [ventaDevolucion, setVentaDevolucion] = useState(null);
  const [devArticuloId, setDevArticuloId] = useState('');
  const [devCantidad, setDevCantidad] = useState('1');
  const [devVuelveAStock, setDevVuelveAStock] = useState(true);
  const [devCarrito, setDevCarrito] = useState([]);
  const [devMotivo, setDevMotivo] = useState(MOTIVOS_DEVOLUCION[0]);
  const [devAutorizadoPorId, setDevAutorizadoPorId] = useState('');
  const [devError, setDevError] = useState('');

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
    listarUsuarios().then(setUsuarios).catch(() => {});
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

  // Precio efectivo para el cliente seleccionado: el de su lista de precio si el artículo
  // tiene uno definido ahí, si no el precio base — misma resolución que ventas.service.js
  // en el backend (lo que se muestra aquí es lo que realmente se va a cobrar).
  function precioEfectivo(articulo) {
    const cliente = clientes.find((c) => c.id === clienteId);
    if (cliente?.listaPrecioId) {
      const porLista = (articulo.precios || []).find((p) => p.listaPrecioId === cliente.listaPrecioId);
      if (porLista) return Number(porLista.precio);
    }
    return Number(articulo.precio);
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
        precio: precioEfectivo(articulo),
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

  async function handleCancelar(ventaId) {
    setError('');
    try {
      await cancelarVenta(ventaId);
      cargarVentas();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cancelar la venta.');
    }
  }

  async function abrirDevolucion(venta) {
    setDevError('');
    setDevCarrito([]);
    setDevMotivo(MOTIVOS_DEVOLUCION[0]);
    setDevAutorizadoPorId('');
    setDevolviendoId(venta.id);
    try {
      const detalle = await obtenerVenta(venta.id);
      setVentaDevolucion(detalle);
    } catch (err) {
      setDevError('No se pudo cargar el detalle de la venta.');
    }
  }

  function cerrarDevolucion() {
    setDevolviendoId(null);
    setVentaDevolucion(null);
    setDevCarrito([]);
  }

  function agregarLineaDevolucion(e) {
    e.preventDefault();
    const linea = ventaDevolucion?.detalles.find((d) => d.articuloId === devArticuloId);
    if (!linea) return;
    const yaEnCarrito = devCarrito
      .filter((l) => l.articuloId === devArticuloId)
      .reduce((acc, l) => acc + l.cantidad, 0);
    const disponible = Number(linea.cantidad) - Number(linea.cantidadDevuelta) - yaEnCarrito;
    const cant = Number(devCantidad);
    if (cant <= 0 || cant > disponible) {
      setDevError(`Cantidad inválida (disponible para devolver: ${disponible}).`);
      return;
    }
    setDevError('');
    setDevCarrito((c) => [
      ...c,
      {
        articuloId: devArticuloId,
        nombre: linea.articulo?.nombre || devArticuloId,
        cantidad: cant,
        precio: Number(linea.precio),
        impuestoTasa: Number(linea.impuestoTasa),
        vuelveAStock: devVuelveAStock,
      },
    ]);
    setDevArticuloId('');
    setDevCantidad('1');
  }

  function quitarLineaDevolucion(index) {
    setDevCarrito((c) => c.filter((_, i) => i !== index));
  }

  const devReembolso = Math.round(
    devCarrito.reduce((acc, l) => acc + l.cantidad * l.precio * (1 + l.impuestoTasa), 0) * 100,
  ) / 100;

  async function confirmarDevolucion(e) {
    e.preventDefault();
    setDevError('');
    if (devCarrito.length === 0) {
      setDevError('Agrega al menos un artículo a devolver.');
      return;
    }
    if (!devAutorizadoPorId) {
      setDevError('Selecciona quién autoriza la devolución.');
      return;
    }
    if (devReembolso > 0 && !sesion) {
      setDevError('Esta devolución implica un reembolso; abre una sesión de caja para esta caja primero.');
      return;
    }
    try {
      await crearDevolucion({
        ventaId: ventaDevolucion.id,
        motivo: devMotivo,
        autorizadoPorId: devAutorizadoPorId,
        sesionCajaId: devReembolso > 0 ? sesion.id : undefined,
        detalles: devCarrito.map((l) => ({
          articuloId: l.articuloId,
          cantidad: l.cantidad,
          vuelveAStock: l.vuelveAStock,
        })),
      });
      cerrarDevolucion();
      cargarVentas();
    } catch (err) {
      setDevError(err.response?.data?.error || 'No se pudo procesar la devolución.');
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 700 }}>
      <p><Link to="/dashboard">← Volver al dashboard</Link></p>
      <h1>Ventas</h1>
      <p><Link to="/ventas/cotizaciones">Ver cotizaciones →</Link></p>

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
                <option key={a.id} value={a.id}>{a.nombre} (${precioEfectivo(a)})</option>
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
            <th />
          </tr>
        </thead>
        <tbody>
          {ventas.map((v) => (
            <Fragment key={v.id}>
              <tr>
                <td>{v.folio}</td>
                <td>{v.cliente?.nombre}</td>
                <td>{v.total}</td>
                <td>{v.estado}</td>
                <td>
                  {v.estado === 'CONFIRMADA' && (
                    <>
                      <button type="button" onClick={() => handleCancelar(v.id)}>Cancelar</button>{' '}
                      <button type="button" onClick={() => abrirDevolucion(v)}>Devolver</button>
                    </>
                  )}
                </td>
              </tr>
              {devolviendoId === v.id && (
                <tr>
                  <td colSpan={5} style={{ background: '#f7f7f7', padding: '1rem' }}>
                    {devError && <p style={{ color: 'crimson' }}>{devError}</p>}
                    {!ventaDevolucion && <p>Cargando detalle de la venta…</p>}
                    {ventaDevolucion && (
                      <>
                        <form
                          onSubmit={agregarLineaDevolucion}
                          style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}
                        >
                          <select value={devArticuloId} onChange={(e) => setDevArticuloId(e.target.value)} required>
                            <option value="">Artículo vendido...</option>
                            {ventaDevolucion.detalles.map((d) => (
                              <option key={d.articuloId} value={d.articuloId}>
                                {d.articulo?.nombre || d.articuloId} (disponible: {Number(d.cantidad) - Number(d.cantidadDevuelta)})
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={devCantidad}
                            onChange={(e) => setDevCantidad(e.target.value)}
                            style={{ width: '80px' }}
                            required
                          />
                          <label>
                            <input
                              type="checkbox"
                              checked={devVuelveAStock}
                              onChange={(e) => setDevVuelveAStock(e.target.checked)}
                            />{' '}
                            Vuelve a stock
                          </label>
                          <button type="submit">Agregar</button>
                        </form>

                        {devCarrito.length > 0 && (
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left' }}>Artículo</th>
                                <th style={{ textAlign: 'left' }}>Cantidad</th>
                                <th style={{ textAlign: 'left' }}>Vuelve a stock</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {devCarrito.map((l, i) => (
                                <tr key={i}>
                                  <td>{l.nombre}</td>
                                  <td>{l.cantidad}</td>
                                  <td>{l.vuelveAStock ? 'Sí' : 'No'}</td>
                                  <td><button type="button" onClick={() => quitarLineaDevolucion(i)}>Quitar</button></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}

                        <form onSubmit={confirmarDevolucion} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <select value={devMotivo} onChange={(e) => setDevMotivo(e.target.value)}>
                            {MOTIVOS_DEVOLUCION.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                          <select value={devAutorizadoPorId} onChange={(e) => setDevAutorizadoPorId(e.target.value)} required>
                            <option value="">Autoriza...</option>
                            {usuarios.map((u) => (
                              <option key={u.id} value={u.id}>{u.nombre}</option>
                            ))}
                          </select>
                          <span>Reembolso: {devReembolso.toFixed(2)}</span>
                          <button type="submit">Confirmar devolución</button>
                          <button type="button" onClick={cerrarDevolucion}>Cancelar</button>
                        </form>
                      </>
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

export default VentasPage;
