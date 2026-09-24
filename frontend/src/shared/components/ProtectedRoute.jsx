import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../layout/AppLayout';
import SinVigenciaLayout from '../layout/SinVigenciaLayout';
import { vigenciaVencida } from '../vigencia';

// `permitirVencida`: solo la pantalla de suscripción. Con la vigencia vencida, el backend
// bloquea todo menos /me y /suscripcion, así que cualquier otra pantalla se manda ahí, y la de
// suscripción se muestra sin el Sidebar/TopBar (que pegan a endpoints ya bloqueados).
function ProtectedRoute({ children, permitirVencida = false }) {
  const { status, esSuperAdmin, empresa } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-500">Cargando...</div>
    );
  }
  if (status === 'anon') return <Navigate to="/login" replace />;
  // El superadmin de plataforma no tiene empresa -- el layout de tenant (Sidebar/Dashboard)
  // asume que sí. Su panel vive aparte, en /superadmin.
  if (esSuperAdmin) return <Navigate to="/superadmin" replace />;
  if (vigenciaVencida(empresa?.vigenciaHasta)) {
    return permitirVencida
      ? <SinVigenciaLayout>{children}</SinVigenciaLayout>
      : <Navigate to="/suscripcion" replace />;
  }
  return <AppLayout>{children}</AppLayout>;
}

export default ProtectedRoute;
