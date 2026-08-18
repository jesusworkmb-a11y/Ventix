import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../layout/AppLayout';

function ProtectedRoute({ children }) {
  const { status, esSuperAdmin } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-500">Cargando...</div>
    );
  }
  if (status === 'anon') return <Navigate to="/login" replace />;
  // El superadmin de plataforma no tiene empresa -- el layout de tenant (Sidebar/Dashboard)
  // asume que sí. Su panel vive aparte, en /superadmin.
  if (esSuperAdmin) return <Navigate to="/superadmin" replace />;
  return <AppLayout>{children}</AppLayout>;
}

export default ProtectedRoute;
