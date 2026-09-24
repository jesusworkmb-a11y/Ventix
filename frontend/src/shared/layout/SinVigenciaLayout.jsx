import { useAuth } from '../context/AuthContext';
import iconoBoxPos from '../../assets/brand/icono-boxpos.png';

// Layout mínimo para la pantalla de suscripción cuando la vigencia ya venció: sin Sidebar ni
// TopBar (sus consultas — alertas de stock, búsqueda — ya están bloqueadas por el backend), solo
// marca, empresa y cerrar sesión. Mismo estilo de encabezado que el panel de superadmin.
function SinVigenciaLayout({ children }) {
  const { empresa, usuario, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <img src={iconoBoxPos} alt="" className="h-8 w-8 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{empresa?.nombreComercial}</p>
            <p className="truncate text-xs text-gray-500">{usuario?.nombre}</p>
          </div>
        </div>
        <button type="button" onClick={logout} className="shrink-0 text-sm text-gray-500 hover:text-gray-800">
          Cerrar sesión
        </button>
      </header>
      <main className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}

export default SinVigenciaLayout;
