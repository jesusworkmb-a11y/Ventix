import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/context/AuthContext';

function DashboardPage() {
  const { usuario, empresa, rol, permisos, logout } = useAuth();

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Ventix</h1>
      <p>Empresa: {empresa?.nombreComercial}</p>
      <p>
        Usuario: {usuario?.nombre} ({usuario?.correo}) — Rol: {rol?.nombre}
      </p>
      <p>Permisos activos: {permisos?.length ?? 0}</p>

      <nav style={{ display: 'flex', gap: '1rem', margin: '1.5rem 0', flexWrap: 'wrap' }}>
        <Link to="/catalogo/articulos">Artículos</Link>
        <Link to="/catalogo/configuracion">Configuración de catálogo</Link>
        <Link to="/clientes">Clientes</Link>
        <Link to="/proveedores">Proveedores</Link>
        <Link to="/inventario/existencias">Existencias</Link>
      </nav>

      <button onClick={logout}>Cerrar sesión</button>
    </div>
  );
}

export default DashboardPage;
