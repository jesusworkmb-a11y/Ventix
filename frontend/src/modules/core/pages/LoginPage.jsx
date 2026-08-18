import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../shared/context/AuthContext';
import Card from '../../../shared/ui/Card';
import Input from '../../../shared/ui/Input';
import Button from '../../../shared/ui/Button';

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
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
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 text-xl font-bold text-white">
            B
          </div>
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
            <Input
              id="password"
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
            )}
            <Button type="submit" disabled={cargando} className="w-full">
              {cargando ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
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
