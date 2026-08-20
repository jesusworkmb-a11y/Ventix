import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Card from '../../../shared/ui/Card';
import Input from '../../../shared/ui/Input';
import Button from '../../../shared/ui/Button';
import { restablecerPassword } from '../api/core.api';
import iconoBoxPos from '../../../assets/brand/icono-boxpos.png';

function RestablecerPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [passwordNueva, setPasswordNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    if (passwordNueva.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (passwordNueva !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setCargando(true);
    try {
      await restablecerPassword({ token, passwordNueva });
      setListo(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo restablecer la contraseña.');
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
          <h1 className="mb-1 text-lg font-semibold text-gray-900">Poner contraseña nueva</h1>

          {!token ? (
            <p className="rounded-lg bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
              Este enlace no es válido. Solicitá uno nuevo desde{' '}
              <Link to="/olvide-password" className="font-medium underline">
                Recuperar acceso
              </Link>.
            </p>
          ) : listo ? (
            <p className="rounded-lg bg-success-50 px-3 py-2.5 text-sm text-success-700">
              Contraseña actualizada. Te llevamos a iniciar sesión...
            </p>
          ) : (
            <form onSubmit={enviar} className="flex flex-col gap-4">
              <Input
                id="passwordNueva"
                label="Contraseña nueva"
                type="password"
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                required
              />
              <Input
                id="confirmar"
                label="Confirmar contraseña"
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                required
              />
              {error && (
                <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
              )}
              <Button type="submit" disabled={cargando} className="w-full">
                {cargando ? 'Guardando...' : 'Guardar contraseña'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

export default RestablecerPasswordPage;
