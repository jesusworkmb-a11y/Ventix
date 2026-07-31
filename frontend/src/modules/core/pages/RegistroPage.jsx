import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registro } from '../api/core.api';
import { useAuth } from '../../../shared/context/AuthContext';

const PAISES = ['MX', 'US', 'CO', 'AR', 'CL', 'PE'];
const MONEDAS = ['MXN', 'USD', 'COP', 'ARS', 'CLP', 'PEN'];

function RegistroPage() {
  const navigate = useNavigate();
  const { setSesion } = useAuth();
  const [form, setForm] = useState({
    nombreComercial: '',
    pais: 'MX',
    moneda: 'MXN',
    zonaHoraria: 'America/Mexico_City',
    nombreAdmin: '',
    correoAdmin: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const data = await registro({
        empresa: {
          nombreComercial: form.nombreComercial,
          pais: form.pais,
          moneda: form.moneda,
          zonaHoraria: form.zonaHoraria,
        },
        admin: { nombre: form.nombreAdmin, correo: form.correoAdmin, password: form.password },
      });
      setSesion(data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo completar el registro.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 420 }}>
      <h1>Registrar empresa</h1>
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label>
          Nombre comercial
          <input
            value={form.nombreComercial}
            onChange={(e) => actualizar('nombreComercial', e.target.value)}
            required
          />
        </label>
        <label>
          País
          <select value={form.pais} onChange={(e) => actualizar('pais', e.target.value)}>
            {PAISES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Moneda
          <select value={form.moneda} onChange={(e) => actualizar('moneda', e.target.value)}>
            {MONEDAS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <hr />
        <label>
          Tu nombre
          <input value={form.nombreAdmin} onChange={(e) => actualizar('nombreAdmin', e.target.value)} required />
        </label>
        <label>
          Tu correo
          <input
            type="email"
            value={form.correoAdmin}
            onChange={(e) => actualizar('correoAdmin', e.target.value)}
            required
          />
        </label>
        <label>
          Contraseña (mínimo 8 caracteres)
          <input
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => actualizar('password', e.target.value)}
            required
          />
        </label>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit" disabled={cargando}>{cargando ? 'Creando...' : 'Crear empresa'}</button>
      </form>
      <p>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
    </div>
  );
}

export default RegistroPage;
