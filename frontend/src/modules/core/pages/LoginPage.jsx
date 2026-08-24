import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../../shared/context/AuthContext';
import Card from '../../../shared/ui/Card';
import Input from '../../../shared/ui/Input';
import Button from '../../../shared/ui/Button';
import iconoBoxPos from '../../../assets/brand/icono-boxpos.png';

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const data = await login({ correo, password });
      navigate(data.esSuperAdmin ? '/superadmin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo iniciar sesión.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img src={iconoBoxPos} alt="BOX POS" className="h-11 w-11 object-contain" />
          <span className="text-xl font-bold text-gray-900">BOX POS</span>
        </div>

        <Card>
          <h1 className="mb-1 text-lg font-semibold text-gray-900">Iniciar sesión</h1>
          <p className="mb-5 text-sm text-gray-500">Ingresá tus credenciales para continuar.</p>

          <form onSubmit={enviar} className="flex flex-col gap-4">
            <Input
              id="correo"
              label="Correo"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">Contraseña</label>
              <div className="relative">
                <input
                  id="password"
                  type={mostrarPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900
                    placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                >
                  {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {error && (
              <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
            )}
            <Button type="submit" disabled={cargando} className="w-full">
              {cargando ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm">
            <Link to="/olvide-password" className="font-medium text-primary-600 hover:text-primary-700">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        </Card>

        <p className="mt-5 text-center text-sm text-gray-500">
          ¿No tenés cuenta?{' '}
          <Link to="/registro" className="font-medium text-primary-600 hover:text-primary-700">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
