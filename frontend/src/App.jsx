import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './shared/context/AuthContext';
import ProtectedRoute from './shared/components/ProtectedRoute';
import RegistroPage from './modules/core/pages/RegistroPage';
import LoginPage from './modules/core/pages/LoginPage';
import DashboardPage from './modules/dashboard/pages/DashboardPage';

// A partir de Fase 1 el enrutamiento real reemplaza el check de conectividad de Fase 0.
function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={(
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
