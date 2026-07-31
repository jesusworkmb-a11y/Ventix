import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children }) {
  const { status } = useAuth();

  if (status === 'loading') return <p style={{ fontFamily: 'sans-serif', padding: '2rem' }}>Cargando...</p>;
  if (status === 'anon') return <Navigate to="/login" replace />;
  return children;
}

export default ProtectedRoute;
