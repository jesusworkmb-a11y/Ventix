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
      <button onClick={logout}>Cerrar sesión</button>
    </div>
  );
}

export default DashboardPage;
