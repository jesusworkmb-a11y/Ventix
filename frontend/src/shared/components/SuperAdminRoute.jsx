import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function SuperAdminRoute({ children }) {
  const { status, esSuperAdmin } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-500">Cargando...</div>
    );
  }
  if (status === 'anon') return <Navigate to="/login" replace />;
  if (!esSuperAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

export default SuperAdminRoute;
