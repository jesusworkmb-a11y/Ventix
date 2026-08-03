import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './shared/context/AuthContext';
import ProtectedRoute from './shared/components/ProtectedRoute';
import RegistroPage from './modules/core/pages/RegistroPage';
import LoginPage from './modules/core/pages/LoginPage';
import SucursalesPage from './modules/core/pages/SucursalesPage';
import UsuariosPage from './modules/core/pages/UsuariosPage';
import RolesPage from './modules/core/pages/RolesPage';
import AuditoriaPage from './modules/core/pages/AuditoriaPage';
import DashboardPage from './modules/dashboard/pages/DashboardPage';
import ArticulosPage from './modules/catalogo/pages/ArticulosPage';
import ConfiguracionCatalogoPage from './modules/catalogo/pages/ConfiguracionCatalogoPage';
import ClientesPage from './modules/clientes/pages/ClientesPage';
import ProveedoresPage from './modules/proveedores/pages/ProveedoresPage';
import ExistenciasPage from './modules/inventario/pages/ExistenciasPage';
import ComprasPage from './modules/compras/pages/ComprasPage';
import CajaPage from './modules/caja/pages/CajaPage';
import VentasPage from './modules/ventas/pages/VentasPage';
import ReportesPage from './modules/reportes/pages/ReportesPage';
import HerramientasPage from './modules/herramientas/pages/HerramientasPage';

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
        <Route
          path="/administracion/sucursales"
          element={(
            <ProtectedRoute>
              <SucursalesPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/administracion/usuarios"
          element={(
            <ProtectedRoute>
              <UsuariosPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/administracion/roles"
          element={(
            <ProtectedRoute>
              <RolesPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/administracion/auditoria"
          element={(
            <ProtectedRoute>
              <AuditoriaPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/catalogo/articulos"
          element={(
            <ProtectedRoute>
              <ArticulosPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/catalogo/configuracion"
          element={(
            <ProtectedRoute>
              <ConfiguracionCatalogoPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/clientes"
          element={(
            <ProtectedRoute>
              <ClientesPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/proveedores"
          element={(
            <ProtectedRoute>
              <ProveedoresPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/inventario/existencias"
          element={(
            <ProtectedRoute>
              <ExistenciasPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/compras"
          element={(
            <ProtectedRoute>
              <ComprasPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/caja"
          element={(
            <ProtectedRoute>
              <CajaPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/ventas"
          element={(
            <ProtectedRoute>
              <VentasPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/reportes"
          element={(
            <ProtectedRoute>
              <ReportesPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/herramientas"
          element={(
            <ProtectedRoute>
              <HerramientasPage />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
