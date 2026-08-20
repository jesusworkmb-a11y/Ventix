import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registro } from '../api/core.api';
import { useAuth } from '../../../shared/context/AuthContext';
import Card from '../../../shared/ui/Card';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Button from '../../../shared/ui/Button';
import iconoBoxPos from '../../../assets/brand/icono-boxpos.png';

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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img src={iconoBoxPos} alt="BOX POS" className="h-11 w-11 object-contain" />
          <span className="text-xl font-bold text-gray-900">BOX POS</span>
        </div>

        <Card>
          <h1 className="mb-1 text-lg font-semibold text-gray-900">Registrar empresa</h1>
          <p className="mb-5 text-sm text-gray-500">Creá tu empresa y tu usuario administrador.</p>

          <form onSubmit={enviar} className="flex flex-col gap-4">
            <Input
              id="nombreComercial"
              label="Nombre comercial"
              value={form.nombreComercial}
              onChange={(e) => actualizar('nombreComercial', e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Select id="pais" label="País" value={form.pais} onChange={(e) => actualizar('pais', e.target.value)}>
                {PAISES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
              <Select
                id="moneda"
                label="Moneda"
                value={form.moneda}
                onChange={(e) => actualizar('moneda', e.target.value)}
              >
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </div>

            <hr className="border-gray-100" />

            <Input
              id="nombreAdmin"
              label="Tu nombre"
              value={form.nombreAdmin}
              onChange={(e) => actualizar('nombreAdmin', e.target.value)}
              required
            />
            <Input
              id="correoAdmin"
              label="Tu correo"
              type="email"
              value={form.correoAdmin}
              onChange={(e) => actualizar('correoAdmin', e.target.value)}
              required
            />
            <Input
              id="passwordRegistro"
              label="Contraseña (mínimo 8 caracteres)"
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => actualizar('password', e.target.value)}
              required
            />

            {error && (
              <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
            )}
            <Button type="submit" disabled={cargando} className="w-full">
              {cargando ? 'Creando...' : 'Crear empresa'}
            </Button>
          </form>
        </Card>

        <p className="mt-5 text-center text-sm text-gray-500">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

export default RegistroPage;
