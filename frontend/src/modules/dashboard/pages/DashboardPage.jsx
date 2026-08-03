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
        {permisos?.includes('administracion.sucursales.ver') && <Link to="/administracion/sucursales">Sucursales</Link>}
        {permisos?.includes('administracion.usuarios.ver') && <Link to="/administracion/usuarios">Usuarios</Link>}
        {permisos?.includes('administracion.roles.ver') && <Link to="/administracion/roles">Roles y permisos</Link>}
        {permisos?.includes('administracion.auditoria.ver') && <Link to="/administracion/auditoria">Auditoría</Link>}
        <Link to="/catalogo/articulos">Artículos</Link>
        <Link to="/catalogo/configuracion">Configuración de catálogo</Link>
        <Link to="/clientes">Clientes</Link>
        <Link to="/proveedores">Proveedores</Link>
        <Link to="/inventario/existencias">Existencias</Link>
        <Link to="/compras">Compras</Link>
        <Link to="/caja">Caja</Link>
        <Link to="/ventas">Ventas</Link>
        <Link to="/reportes">Reportes</Link>
        <Link to="/herramientas">Herramientas</Link>
      </nav>

      <button onClick={logout}>Cerrar sesión</button>
    </div>
  );
}

export default DashboardPage;
