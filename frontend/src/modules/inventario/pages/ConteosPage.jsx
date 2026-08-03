import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarConteos,
  obtenerConteo,
  crearConteo,
  reemplazarDetallesConteo,
  cambiarEstadoConteo,
} from '../api/conteos.api';
import { listarSucursales } from '../../core/api/core.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';

const SIGUIENTE_ESTADO = { CAPTURA: 'REVISION', REVISION: 'AUTORIZADO' };

function ConteosPage() {
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [error, setError] = useState('');
  const [conteos, setConteos] = useState([]);

  const [abiertoId, setAbiertoId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [capArticuloId, setCapArticuloId] = useState('');
  const [capCantidad, setCapCantidad] = useState('');
  const [capCarrito, setCapCarrito] = useState([]);
  const [panelError, setPanelError] = useState('');

  useEffect(() => {
    listarSucursales()
      .then((data) => {
        setSucursales(data);
        if (data.length) setSucursalId((actual) => actual || data[0].id);
      })
      .catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
    cargarConteos();
  }, []);

  function cargarConteos() {
    listarConteos().then(setConteos).catch(() => {});
  }

  function nombreSucursal(id) {
    return sucursales.find((s) => s.id === id)?.nombre || id;
  }

  async function handleCrear(e) {
    e.preventDefault();
    setError('');
    try {
      const conteo = await crearConteo({ sucursalId });
      cargarConteos();
      abrirConteo(conteo.id);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el conteo.');
    }
  }

  async function abrirConteo(id) {
    setPanelError('');
    setAbiertoId(id);
    setDetalle(null);
    setCapCarrito([]);
    try {
      const d = await obtenerConteo(id);
      setDetalle(d);
      if (d.estado === 'CAPTURA') {
        setCapCarrito(d.detalles.map((det) => ({
          articuloId: det.articuloId,
          nombre: det.articulo?.nombre || det.articuloId,
          cantidadFisica: Number(det.cantidadFisica),
        })));
      }
    } catch (err) {
      setPanelError('No se pudo cargar el conteo.');
    }
  }

  function agregarLineaCaptura(e) {
    e.preventDefault();
    const articulo = articulos.find((a) => a.id === capArticuloId);
    if (!articulo) return;
    setCapCarrito((c) => [
      ...c.filter((l) => l.articuloId !== capArticuloId),
      { articuloId: capArticuloId, nombre: articulo.nombre, cantidadFisica: Number(capCantidad) },
    ]);
    setCapArticuloId('');
    setCapCantidad('');
  }

  function quitarLineaCaptura(articuloId) {
    setCapCarrito((c) => c.filter((l) => l.articuloId !== articuloId));
  }

  async function guardarLineas() {
    setPanelError('');
    try {
      await reemplazarDetallesConteo(abiertoId, {
        detalles: capCarrito.map((l) => ({ articuloId: l.articuloId, cantidadFisica: l.cantidadFisica })),
      });
      await abrirConteo(abiertoId);
    } catch (err) {
      setPanelError(err.response?.data?.error || 'No se pudieron guardar las líneas.');
    }
  }

  async function avanzarEstado() {
    setPanelError('');
    try {
      await cambiarEstadoConteo(abiertoId, { estado: SIGUIENTE_ESTADO[detalle.estado] });
      await abrirConteo(abiertoId);
      cargarConteos();
    } catch (err) {
      setPanelError(err.response?.data?.error || 'No se pudo cambiar el estado.');
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 700 }}>
      <p><Link to="/inventario/existencias">← Volver a Existencias</Link></p>
      <h1>Conteos físicos</h1>
      <p>
        <Link to="/inventario/ajustes">Ver ajustes →</Link>{' '}
        <Link to="/inventario/transferencias">Ver transferencias →</Link>
      </p>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <h2>Nuevo conteo</h2>
      <form onSubmit={handleCrear} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '2rem' }}>
        <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
          {sucursales.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
        <button type="submit">Iniciar conteo</button>
      </form>

      <h2>Conteos recientes</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Sucursal</th>
            <th style={{ textAlign: 'left' }}>Estado</th>
            <th style={{ textAlign: 'left' }}>Fecha</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {conteos.map((c) => (
            <Fragment key={c.id}>
              <tr>
                <td>{nombreSucursal(c.sucursalId)}</td>
                <td>{c.estado}</td>
                <td>{new Date(c.creadoEn).toLocaleString()}</td>
                <td><button type="button" onClick={() => abrirConteo(c.id)}>Abrir</button></td>
              </tr>
              {abiertoId === c.id && (
                <tr>
                  <td colSpan={4} style={{ background: '#f7f7f7', padding: '1rem' }}>
                    {panelError && <p style={{ color: 'crimson' }}>{panelError}</p>}
                    {!detalle && <p>Cargando…</p>}
                    {detalle && detalle.estado === 'CAPTURA' && (
                      <>
                        <form
                          onSubmit={agregarLineaCaptura}
                          style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}
                        >
                          <select value={capArticuloId} onChange={(e) => setCapArticuloId(e.target.value)} required>
                            <option value="">Artículo...</option>
                            {articulos.map((a) => (
                              <option key={a.id} value={a.id}>{a.nombre}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Cantidad física"
                            value={capCantidad}
                            onChange={(e) => setCapCantidad(e.target.value)}
                            style={{ width: '140px' }}
                            required
                          />
                          <button type="submit">Agregar/actualizar línea</button>
                        </form>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left' }}>Artículo</th>
                              <th style={{ textAlign: 'left' }}>Cantidad física</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {capCarrito.map((l) => (
                              <tr key={l.articuloId}>
                                <td>{l.nombre}</td>
                                <td>{l.cantidadFisica}</td>
                                <td><button type="button" onClick={() => quitarLineaCaptura(l.articuloId)}>Quitar</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <button type="button" onClick={guardarLineas}>Guardar líneas</button>{' '}
                        <button type="button" onClick={avanzarEstado} disabled={detalle.detalles.length === 0}>
                          Pasar a revisión
                        </button>
                      </>
                    )}
                    {detalle && detalle.estado !== 'CAPTURA' && (
                      <>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left' }}>Artículo</th>
                              <th style={{ textAlign: 'left' }}>Sistema</th>
                              <th style={{ textAlign: 'left' }}>Física</th>
                              <th style={{ textAlign: 'left' }}>Diferencia</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detalle.detalles.map((d) => {
                              const diferencia = Number(d.cantidadFisica) - Number(d.cantidadSistema);
                              return (
                                <tr key={d.id}>
                                  <td>{d.articulo?.nombre || d.articuloId}</td>
                                  <td>{d.cantidadSistema}</td>
                                  <td>{d.cantidadFisica}</td>
                                  <td>{diferencia > 0 ? `+${diferencia}` : diferencia}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {detalle.estado === 'REVISION' && (
                          <button type="button" onClick={avanzarEstado}>Autorizar (aplica el ajuste a existencias)</button>
                        )}
                        {detalle.estado === 'AUTORIZADO' && <p>Conteo autorizado — ajuste ya aplicado al kardex.</p>}
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

export default ConteosPage;
