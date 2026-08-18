import { useEffect, useState } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import Card from '../../../shared/ui/Card';
import Badge from '../../../shared/ui/Badge';
import Button from '../../../shared/ui/Button';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { listarEmpresasSuperadmin, cambiarEstadoEmpresaSuperadmin } from '../api/core.api';

const ESTADO_TONO = { ACTIVA: 'success', SUSPENDIDA: 'warning', ARCHIVADA: 'gray' };

function SuperAdminPage() {
  const { usuario, logout } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [actualizandoId, setActualizandoId] = useState(null);

  function cargar() {
    setCargando(true);
    listarEmpresasSuperadmin()
      .then(setEmpresas)
      .catch(() => setError('No se pudo cargar la lista de empresas.'))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function alternarEstado(empresa) {
    const nuevoEstado = empresa.estado === 'SUSPENDIDA' ? 'ACTIVA' : 'SUSPENDIDA';
    setActualizandoId(empresa.id);
    setError('');
    try {
      await cambiarEstadoEmpresaSuperadmin(empresa.id, nuevoEstado);
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo actualizar el estado.');
    } finally {
      setActualizandoId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <p className="text-sm text-gray-500">Ventix — Panel de plataforma</p>
          <h1 className="text-lg font-semibold text-gray-900">{usuario?.nombre}</h1>
        </div>
        <button type="button" onClick={logout} className="text-sm text-gray-500 hover:text-gray-800">
          Cerrar sesión
        </button>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Empresas</h2>
          <p className="text-sm text-gray-500">
            Todas las empresas dadas de alta en Ventix. Suspender una corta el acceso de sus
            usuarios de inmediato, incluidas sesiones ya abiertas.
          </p>
        </div>

        {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}

        <Card>
          <Table columnas={['Empresa', 'Correo', 'Usuarios', 'Sucursales', 'Alta', 'Estado', '']}>
            {!cargando && empresas.length === 0 && <TablaVacia colSpan={7} />}
            {empresas.map((e) => (
              <Fila key={e.id}>
                <Celda className="font-medium text-gray-800">{e.nombreComercial}</Celda>
                <Celda>{e.correo || '—'}</Celda>
                <Celda>{e._count.usuariosEmpresa}</Celda>
                <Celda>{e._count.sucursales}</Celda>
                <Celda>{new Date(e.creadoEn).toLocaleDateString('es-MX')}</Celda>
                <Celda><Badge tono={ESTADO_TONO[e.estado] || 'gray'}>{e.estado}</Badge></Celda>
                <Celda className="text-right">
                  {e.estado !== 'ARCHIVADA' && (
                    <Button
                      variant={e.estado === 'SUSPENDIDA' ? 'primary' : 'danger'}
                      size="sm"
                      disabled={actualizandoId === e.id}
                      onClick={() => alternarEstado(e)}
                    >
                      {e.estado === 'SUSPENDIDA' ? 'Reactivar' : 'Suspender'}
                    </Button>
                  )}
                </Celda>
              </Fila>
            ))}
          </Table>
        </Card>
      </main>
    </div>
  );
}

export default SuperAdminPage;
