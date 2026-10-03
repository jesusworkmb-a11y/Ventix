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
// Viven en el sitio público (repo boxpos-web), no en la app.
const URL_TERMINOS = 'https://boxpos.com.mx/terminos/';
const URL_PRIVACIDAD = 'https://boxpos.com.mx/privacidad/';

function RegistroPage() {
  const navigate = useNavigate();
  const { setSesion } = useAuth();
  const [form, setForm] = useState({
    nombreComercial: '',
    telefono: '',
    pais: 'MX',
    moneda: 'MXN',
    zonaHoraria: 'America/Mexico_City',
    nombreAdmin: '',
    correoAdmin: '',
    password: '',
    aceptaTerminos: false,
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
          telefono: form.telefono,
          pais: form.pais,
          moneda: form.moneda,
          zonaHoraria: form.zonaHoraria,
        },
        admin: { nombre: form.nombreAdmin, correo: form.correoAdmin, password: form.password },
        aceptaTerminos: form.aceptaTerminos,
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
          <p className="mb-5 text-sm text-gray-500">Crea tu empresa y tu usuario administrador.</p>

          <form onSubmit={enviar} className="flex flex-col gap-4">
            <Input
              id="nombreComercial"
              label="Nombre comercial"
              value={form.nombreComercial}
              onChange={(e) => actualizar('nombreComercial', e.target.value)}
              required
            />
            <Input
              id="telefonoEmpresa"
              label="Teléfono"
              value={form.telefono}
              onChange={(e) => actualizar('telefono', e.target.value)}
              minLength={10}
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

            <label className="flex items-start gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.aceptaTerminos}
                onChange={(e) => actualizar('aceptaTerminos', e.target.checked)}
                required
                aria-labelledby="textoTerminos"
                className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span id="textoTerminos">
                Acepto los{' '}
                <a href={URL_TERMINOS} target="_blank" rel="noreferrer" className="font-medium text-primary-600 hover:text-primary-700">
                  Términos y Condiciones
                </a>{' '}
                y el{' '}
                <a href={URL_PRIVACIDAD} target="_blank" rel="noreferrer" className="font-medium text-primary-600 hover:text-primary-700">
                  Aviso de Privacidad
                </a>
                .
              </span>
            </label>

            {error && (
              <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
            )}
            <Button type="submit" disabled={cargando} className="w-full">
              {cargando ? 'Creando...' : 'Crear empresa'}
            </Button>
          </form>
        </Card>

        <p className="mt-5 text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

export default RegistroPage;
