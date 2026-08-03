import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarCotizaciones, obtenerCotizacion, crearCotizacion, convertirCotizacion } from '../api/cotizaciones.api';
import { listarCajas, listarSesiones } from '../../caja/api/caja.api';
import { listarClientes } from '../../clientes/api/clientes.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';

function CotizacionesPage() {
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [articuloId, setArticuloId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [carrito, setCarrito] = useState([]);
  const [error, setError] = useState('');
  const [creada, setCreada] = useState(null);
  const [cotizaciones, setCotizaciones] = useState([]);

  const [cajas, setCajas] = useState([]);
  const [cajaId, setCajaId] = useState('');
  const [sesion, setSesion] = useState(null);
  const [convirtiendoId, setConvirtiendoId] = useState(null);
  const [convTotal, setConvTotal] = useState(null);
  const [convMetodoPago, setConvMetodoPago] = useState('EFECTIVO');
  const [convError, setConvError] = useState('');

  useEffect(() => {
    listarClientes()
      .then((data) => {
        setClientes(data);
        const general = data.find((c) => c.esGeneral);
        setClienteId((actual) => actual || (general ? general.id : ''));
      })
      .catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
    listarCajas()
      .then((data) => {
        setCajas(data);
        if (data.length) setCajaId((actual) => actual || data[0].id);
      })
      .catch(() => {});
    cargarCotizaciones();
  }, []);

  useEffect(() => {
    if (cajaId) verificarSesion(cajaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cajaId]);

  function cargarCotizaciones() {
    listarCotizaciones().then(setCotizaciones).catch(() => {});
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
    setCarrito((c) => [
      ...c,
      { articuloId, nombre: articulo.nombre, cantidad: Number(cantidad), precio: Number(articulo.precio) },
    ]);
    setArticuloId('');
    setCantidad('1');
  }

  function quitarLinea(index) {
    setCarrito((c) => c.filter((_, i) => i !== index));
  }

  const total = Math.round(carrito.reduce((acc, l) => acc + l.cantidad * l.precio, 0) * 100) / 100;

  async function confirmarCotizacion(e) {
    e.preventDefault();
    setError('');
    setCreada(null);
    if (carrito.length === 0) {
      setError('Agrega al menos un artículo.');
      return;
    }
    const caja = cajas.find((c) => c.id === cajaId);
    if (!caja) {
      setError('Selecciona una sucursal (vía caja) para la cotización.');
      return;
    }
    try {
      const cotizacion = await crearCotizacion({
        sucursalId: caja.sucursalId,
        clienteId,
        detalles: carrito.map((l) => ({ articuloId: l.articuloId, cantidad: l.cantidad })),
      });
      setCreada(cotizacion);
      setCarrito([]);
      cargarCotizaciones();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la cotización.');
    }
  }

  // La cotización solo guarda el subtotal (sin impuesto — ver Cotizacion.total en el schema);
  // el impuesto se calcula recién al convertir, con la tasa vigente en ese momento (igual que
  // ventasService.crear). Hay que recalcularlo aquí con el mismo criterio para saber cuánto
  // cobrar antes de convertir, o la suma de pagos no coincide con el total real de la venta.
  async function abrirConversion(cotizacionId) {
    setConvError('');
    setConvTotal(null);
    setConvirtiendoId(cotizacionId);
    try {
      const detalle = await obtenerCotizacion(cotizacionId);
      const totalConImpuesto = detalle.detalles.reduce((acc, d) => {
        const articulo = articulos.find((a) => a.id === d.articuloId);
        const tasa = articulo?.impuesto ? Number(articulo.impuesto.tasa) : 0;
        return acc + Number(d.cantidad) * Number(d.precio) * (1 + tasa);
      }, 0);
      setConvTotal(Math.round(totalConImpuesto * 100) / 100);
    } catch (err) {
      setConvError('No se pudo calcular el total a cobrar.');
    }
  }

  async function confirmarConversion(e, cotizacion) {
    e.preventDefault();
    setConvError('');
    if (!sesion) {
      setConvError('No hay una sesión de caja abierta para esta caja.');
      return;
    }
    if (convTotal === null) return;
    try {
      await convertirCotizacion(cotizacion.id, {
        sesionCajaId: sesion.id,
        pagos: [{ metodo: convMetodoPago, monto: convTotal }],
      });
      setConvirtiendoId(null);
      cargarCotizaciones();
    } catch (err) {
      setConvError(err.response?.data?.error || 'No se pudo convertir la cotización.');
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 700 }}>
      <p><Link to="/ventas">← Volver a Ventas</Link></p>
      <h1>Cotizaciones</h1>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {creada && (
        <div style={{ background: '#f0f0f0', padding: '1rem', margin: '1rem 0' }}>
          <p>Cotización {creada.folio} creada. Total: {creada.total}</p>
        </div>
      )}

      <h2>Nueva cotización</h2>
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

      <p>Total: {total.toFixed(2)}</p>

      <form onSubmit={confirmarCotizacion} style={{ marginBottom: '2rem' }}>
        <button type="submit">Crear cotización</button>
      </form>

      <h2>Convertir en venta</h2>
      {cajas.length > 0 && (
        <label>
          Caja para cobrar
          <select value={cajaId} onChange={(e) => setCajaId(e.target.value)}>
            {cajas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
      )}
      {cajaId && !sesion && (
        <p>
          Esta caja no tiene una sesión abierta. <Link to="/caja">Abre una en Caja</Link> antes de convertir.
        </p>
      )}

      <h2>Cotizaciones recientes</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Folio</th>
            <th style={{ textAlign: 'left' }}>Total</th>
            <th style={{ textAlign: 'left' }}>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {cotizaciones.map((c) => (
            <Fragment key={c.id}>
              <tr>
                <td>{c.folio}</td>
                <td>{c.total}</td>
                <td>{c.convertidaEnVentaId ? 'Convertida' : 'Pendiente'}</td>
                <td>
                  {!c.convertidaEnVentaId && (
                    <button type="button" onClick={() => abrirConversion(c.id)}>Convertir en venta</button>
                  )}
                </td>
              </tr>
              {convirtiendoId === c.id && (
                <tr>
                  <td colSpan={4} style={{ background: '#f7f7f7', padding: '1rem' }}>
                    {convError && <p style={{ color: 'crimson' }}>{convError}</p>}
                    <form
                      onSubmit={(e) => confirmarConversion(e, c)}
                      style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <select value={convMetodoPago} onChange={(e) => setConvMetodoPago(e.target.value)}>
                        <option value="EFECTIVO">Efectivo</option>
                        <option value="TARJETA">Tarjeta</option>
                        <option value="TRANSFERENCIA">Transferencia</option>
                        <option value="MIXTO">Mixto</option>
                      </select>
                      <span>Total a cobrar: {convTotal === null ? 'calculando…' : convTotal.toFixed(2)}</span>
                      <button type="submit" disabled={convTotal === null}>Confirmar conversión</button>
                      <button type="button" onClick={() => setConvirtiendoId(null)}>Cancelar</button>
                    </form>
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

export default CotizacionesPage;
