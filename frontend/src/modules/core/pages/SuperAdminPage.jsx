import { useEffect, useState } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import Card from '../../../shared/ui/Card';
import Badge from '../../../shared/ui/Badge';
import Button from '../../../shared/ui/Button';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import {
  listarEmpresasSuperadmin,
  cambiarEstadoEmpresaSuperadmin,
  actualizarVigenciaEmpresaSuperadmin,
  actualizarPlanEmpresaSuperadmin,
} from '../api/core.api';

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

  async function guardarVigencia(empresa, valor) {
    setActualizandoId(empresa.id);
    setError('');
    try {
      await actualizarVigenciaEmpresaSuperadmin(empresa.id, valor || null);
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo actualizar la vigencia.');
    } finally {
      setActualizandoId(null);
    }
  }

  function guardarPlan(empresa, valor) {
    const nuevo = valor.trim();
    if (!nuevo || nuevo === empresa.plan) return;
    setActualizandoId(empresa.id);
    setError('');
    actualizarPlanEmpresaSuperadmin(empresa.id, nuevo)
      .then(cargar)
      .catch((err) => setError(err.response?.data?.error || 'No se pudo actualizar el plan.'))
      .finally(() => setActualizandoId(null));
  }

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
          <p className="text-sm text-gray-500">BOX POS — Panel de plataforma</p>
          <h1 className="text-lg font-semibold text-gray-900">{usuario?.nombre}</h1>
        </div>
        <button type="button" onClick={logout} className="text-sm text-gray-500 hover:text-gray-800">
          Cerrar sesión
        </button>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Empresas</h2>
          <p className="text-sm text-gray-500">
            Todas las empresas dadas de alta en BOX POS. Suspender una corta el acceso de sus
            usuarios de inmediato, incluidas sesiones ya abiertas. Una vigencia vencida bloquea
            el acceso igual, pero con su propio mensaje para el cliente — dejá el campo vacío
            para que la empresa no tenga vencimiento.
          </p>
        </div>

        {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}

        <Card>
          <Table columnas={['Empresa', 'Correo', 'Usuarios', 'Sucursales', 'Plan', 'Alta', 'Vigencia', 'Estado', '']}>
            {!cargando && empresas.length === 0 && <TablaVacia colSpan={9} />}
            {empresas.map((e) => {
              const vencida = e.vigenciaHasta && new Date(e.vigenciaHasta) < new Date();
              return (
                <Fila key={e.id}>
                  <Celda className="font-medium text-gray-800">{e.nombreComercial}</Celda>
                  <Celda>{e.correo || '—'}</Celda>
                  <Celda>{e._count.usuariosEmpresa}</Celda>
                  <Celda>{e._count.sucursales}</Celda>
                  <Celda>
                    <input
                      type="text"
                      key={e.plan}
                      defaultValue={e.plan}
                      aria-label={`Plan de ${e.nombreComercial}`}
                      onBlur={(ev) => guardarPlan(e, ev.target.value)}
                      disabled={actualizandoId === e.id}
                      className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </Celda>
                  <Celda>{new Date(e.creadoEn).toLocaleDateString('es-MX')}</Celda>
                  <Celda>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        aria-label={`Vigencia de ${e.nombreComercial}`}
                        value={e.vigenciaHasta ? e.vigenciaHasta.slice(0, 10) : ''}
                        onChange={(ev) => guardarVigencia(e, ev.target.value)}
                        disabled={actualizandoId === e.id}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900
                          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      {vencida && <Badge tono="danger">Vencida</Badge>}
                    </div>
                  </Celda>
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
              );
            })}
          </Table>
        </Card>
      </main>
    </div>
  );
}

export default SuperAdminPage;
