import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './shared/context/AuthContext';
import ProtectedRoute from './shared/components/ProtectedRoute';
import RegistroPage from './modules/core/pages/RegistroPage';
import LoginPage from './modules/core/pages/LoginPage';
import EmpresaPage from './modules/core/pages/EmpresaPage';
import ConfiguracionFiscalPage from './modules/core/pages/ConfiguracionFiscalPage';
import SucursalesPage from './modules/core/pages/SucursalesPage';
import UsuariosPage from './modules/core/pages/UsuariosPage';
import RolesPage from './modules/core/pages/RolesPage';
import AuditoriaPage from './modules/core/pages/AuditoriaPage';
import DashboardPage from './modules/dashboard/pages/DashboardPage';
import ArticulosPage from './modules/catalogo/pages/ArticulosPage';
import ArticuloNuevoPage from './modules/catalogo/pages/ArticuloNuevoPage';
import ConfiguracionCatalogoPage from './modules/catalogo/pages/ConfiguracionCatalogoPage';
import ClientesPage from './modules/clientes/pages/ClientesPage';
import ClienteNuevoPage from './modules/clientes/pages/ClienteNuevoPage';
import ProveedoresPage from './modules/proveedores/pages/ProveedoresPage';
import ProveedorNuevoPage from './modules/proveedores/pages/ProveedorNuevoPage';
import ExistenciasPage from './modules/inventario/pages/ExistenciasPage';
import AjustesPage from './modules/inventario/pages/AjustesPage';
import TransferenciasPage from './modules/inventario/pages/TransferenciasPage';
import ConteosPage from './modules/inventario/pages/ConteosPage';
import ComprasPage from './modules/compras/pages/ComprasPage';
import ComprasHistorialPage from './modules/compras/pages/ComprasHistorialPage';
import OrdenCompraPage from './modules/compras/pages/OrdenCompraPage';
import OrdenesCompraHistorialPage from './modules/compras/pages/OrdenesCompraHistorialPage';
import CajaPage from './modules/caja/pages/CajaPage';
import VentasPage from './modules/ventas/pages/VentasPage';
import VentasHistorialPage from './modules/ventas/pages/VentasHistorialPage';
import CotizacionesPage from './modules/ventas/pages/CotizacionesPage';
import CotizacionesHistorialPage from './modules/ventas/pages/CotizacionesHistorialPage';
import ReportesPage from './modules/reportes/pages/ReportesPage';
import HerramientasPage from './modules/herramientas/pages/HerramientasPage';
import FacturasPage from './modules/facturacion/pages/FacturasPage';
import FacturaDirectaPage from './modules/facturacion/pages/FacturaDirectaPage';
import FacturaGlobalPage from './modules/facturacion/pages/FacturaGlobalPage';

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
          path="/administracion/empresa"
          element={(
            <ProtectedRoute>
              <EmpresaPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/administracion/fiscal"
          element={(
            <ProtectedRoute>
              <ConfiguracionFiscalPage />
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
          path="/catalogo/articulos/nuevo"
          element={(
            <ProtectedRoute>
              <ArticuloNuevoPage />
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
          path="/clientes/nuevo"
          element={(
            <ProtectedRoute>
              <ClienteNuevoPage />
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
          path="/proveedores/nuevo"
          element={(
            <ProtectedRoute>
              <ProveedorNuevoPage />
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
          path="/inventario/ajustes"
          element={(
            <ProtectedRoute>
              <AjustesPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/inventario/transferencias"
          element={(
            <ProtectedRoute>
              <TransferenciasPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/inventario/conteos"
          element={(
            <ProtectedRoute>
              <ConteosPage />
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
          path="/compras/recientes"
          element={(
            <ProtectedRoute>
              <ComprasHistorialPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/compras/ordenes"
          element={(
            <ProtectedRoute>
              <OrdenCompraPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/compras/ordenes/recientes"
          element={(
            <ProtectedRoute>
              <OrdenesCompraHistorialPage />
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
          path="/ventas/cotizaciones"
          element={(
            <ProtectedRoute>
              <CotizacionesPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/ventas/cotizaciones/recientes"
          element={(
            <ProtectedRoute>
              <CotizacionesHistorialPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/ventas/recientes"
          element={(
            <ProtectedRoute>
              <VentasHistorialPage />
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
        <Route
          path="/facturacion"
          element={(
            <ProtectedRoute>
              <FacturasPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/facturacion/directa"
          element={(
            <ProtectedRoute>
              <FacturaDirectaPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/facturacion/global"
          element={(
            <ProtectedRoute>
              <FacturaGlobalPage />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
