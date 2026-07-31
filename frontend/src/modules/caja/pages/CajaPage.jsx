import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarCajas,
  listarSesiones,
  obtenerSesion,
  abrirSesion,
  cerrarSesion,
  registrarMovimiento,
} from '../api/caja.api';

function CajaPage() {
  const [cajas, setCajas] = useState([]);
  const [cajaId, setCajaId] = useState('');
  const [sesion, setSesion] = useState(null);
  const [error, setError] = useState('');
  const [cierre, setCierre] = useState(null);

  const [fondoInicial, setFondoInicial] = useState('');
  const [movTipo, setMovTipo] = useState('INGRESO');
  const [movMonto, setMovMonto] = useState('');
  const [movMotivo, setMovMotivo] = useState('');
  const [saldoReal, setSaldoReal] = useState('');

  useEffect(() => {
    listarCajas()
      .then((data) => {
        setCajas(data);
        if (data.length) setCajaId((actual) => actual || data[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cajaId) cargarSesionAbierta(cajaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cajaId]);

  async function cargarSesionAbierta(id) {
    setError('');
    try {
      const abiertas = await listarSesiones({ cajaId: id, abierta: 'true' });
      if (abiertas.length) {
        const detalle = await obtenerSesion(abiertas[0].id);
        setSesion(detalle);
      } else {
        setSesion(null);
      }
    } catch (err) {
      setError('No se pudo cargar el estado de la caja.');
    }
  }

  async function handleAbrir(e) {
    e.preventDefault();
    setError('');
    setCierre(null);
    try {
      await abrirSesion({ cajaId, fondoInicial: Number(fondoInicial) });
      setFondoInicial('');
      cargarSesionAbierta(cajaId);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo abrir la sesión.');
    }
  }

  async function handleMovimiento(e) {
    e.preventDefault();
    setError('');
    try {
      await registrarMovimiento(sesion.id, {
        tipo: movTipo,
        monto: Number(movMonto),
        motivo: movMotivo || undefined,
      });
      setMovMonto('');
      setMovMotivo('');
      cargarSesionAbierta(cajaId);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar el movimiento.');
    }
  }

  async function handleCerrar(e) {
    e.preventDefault();
    setError('');
    try {
      const resultado = await cerrarSesion(sesion.id, { saldoReal: Number(saldoReal) });
      setCierre(resultado);
      setSesion(null);
      setSaldoReal('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cerrar la sesión.');
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 500 }}>
      <p><Link to="/dashboard">← Volver al dashboard</Link></p>
      <h1>Caja</h1>

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

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {cierre && (
        <div style={{ background: '#f0f0f0', padding: '1rem', margin: '1rem 0' }}>
          <p>
            Sesión cerrada. Esperado: {cierre.saldoEsperado} — Real: {cierre.saldoReal} — Diferencia:{' '}
            {cierre.diferencia}
          </p>
        </div>
      )}

      {cajaId && !sesion && (
        <form
          onSubmit={handleAbrir}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 300, marginTop: '1rem' }}
        >
          <h2>Abrir sesión</h2>
          <label>
            Fondo inicial
            <input
              type="number"
              step="0.01"
              min="0"
              value={fondoInicial}
              onChange={(e) => setFondoInicial(e.target.value)}
              required
            />
          </label>
          <button type="submit">Abrir</button>
        </form>
      )}

      {sesion && (
        <div style={{ marginTop: '1rem' }}>
          <h2>Sesión abierta</h2>
          <p>
            Fondo inicial: {sesion.fondoInicial} — Abierta: {new Date(sesion.abiertaEn).toLocaleString()}
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '1rem 0' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Tipo</th>
                <th style={{ textAlign: 'left' }}>Monto</th>
                <th style={{ textAlign: 'left' }}>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {sesion.movimientos.map((m) => (
                <tr key={m.id}>
                  <td>{m.tipo}</td>
                  <td>{m.monto}</td>
                  <td>{m.motivo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <form
            onSubmit={handleMovimiento}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}
          >
            <select value={movTipo} onChange={(e) => setMovTipo(e.target.value)}>
              <option value="INGRESO">Ingreso</option>
              <option value="RETIRO">Retiro</option>
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Monto"
              value={movMonto}
              onChange={(e) => setMovMonto(e.target.value)}
              required
            />
            <input placeholder="Motivo (opcional)" value={movMotivo} onChange={(e) => setMovMotivo(e.target.value)} />
            <button type="submit">Registrar</button>
          </form>

          <form onSubmit={handleCerrar} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label>
              Saldo real al cerrar
              <input
                type="number"
                step="0.01"
                min="0"
                value={saldoReal}
                onChange={(e) => setSaldoReal(e.target.value)}
                required
              />
            </label>
            <button type="submit">Cerrar sesión</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default CajaPage;
