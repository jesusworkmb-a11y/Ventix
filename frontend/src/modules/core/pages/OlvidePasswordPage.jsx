import { useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../../shared/ui/Card';
import Input from '../../../shared/ui/Input';
import Button from '../../../shared/ui/Button';
import { recuperarAcceso } from '../api/core.api';
import iconoBoxPos from '../../../assets/brand/icono-boxpos.png';

function OlvidePasswordPage() {
  const [correo, setCorreo] = useState('');
  const [numeroEmpresa, setNumeroEmpresa] = useState('');
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await recuperarAcceso({ correo, numeroEmpresa });
      setEnviado(true);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo procesar la solicitud.');
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
          <h1 className="mb-1 text-lg font-semibold text-gray-900">Recuperar acceso</h1>
          <p className="mb-5 text-sm text-gray-500">
            Ingresá tu correo y el número de empresa (lo encontrás en Administración → Empresa,
            o pedíselo a quien dio de alta tu cuenta). Si coinciden, te mandamos un enlace para
            poner una contraseña nueva.
          </p>

          {enviado ? (
            <p className="rounded-lg bg-success-50 px-3 py-2.5 text-sm text-success-700">
              Si los datos coinciden con una cuenta, te llegará un correo con instrucciones en
              unos minutos. Revisá también la carpeta de spam.
            </p>
          ) : (
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
                id="numeroEmpresa"
                label="Número de empresa"
                placeholder="BOX-0001"
                value={numeroEmpresa}
                onChange={(e) => setNumeroEmpresa(e.target.value)}
                required
              />
              {error && (
                <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
              )}
              <Button type="submit" disabled={cargando} className="w-full">
                {cargando ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </Button>
            </form>
          )}
        </Card>

        <p className="mt-5 text-center text-sm text-gray-500">
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

export default OlvidePasswordPage;
