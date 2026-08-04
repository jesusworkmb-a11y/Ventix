import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../layout/AppLayout';

function ProtectedRoute({ children }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-500">Cargando...</div>
    );
  }
  if (status === 'anon') return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

export default ProtectedRoute;
