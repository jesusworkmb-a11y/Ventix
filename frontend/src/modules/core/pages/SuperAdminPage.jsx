import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../../../shared/context/AuthContext';
import Card from '../../../shared/ui/Card';
import Badge from '../../../shared/ui/Badge';
import Button from '../../../shared/ui/Button';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { formatoNumeroEmpresa } from '../../../shared/format';
import {
  listarEmpresasSuperadmin,
  cambiarEstadoEmpresaSuperadmin,
  actualizarVigenciaEmpresaSuperadmin,
  actualizarPlanEmpresaSuperadmin,
} from '../api/core.api';

const ESTADO_TONO = { ACTIVA: 'success', SUSPENDIDA: 'warning', ARCHIVADA: 'gray' };

// Teléfono/Correo y Usuarios/Sucursales van combinados en una sola columna cada uno (ver Celda
// más abajo) -- con las 11 columnas separadas la tabla no cabía sin scroll horizontal en un
// laptop normal (1268px de tabla contra ~1170px disponibles a 1366px de pantalla).
const COLUMNAS = [
  { label: 'Número', clave: 'numero', ordenable: true },
  { label: 'Empresa', clave: 'nombreComercial', ordenable: true },
  { label: 'Contacto', clave: 'telefono', ordenable: true },
  { label: 'Usuarios / Sucursales', clave: 'usuarios', ordenable: true },
  { label: 'Plan', clave: 'plan', ordenable: true },
  { label: 'Alta', clave: 'creadoEn', ordenable: true },
  { label: 'Vigencia', clave: 'vigenciaHasta', ordenable: true },
  { label: 'Estado', clave: 'estado', ordenable: true },
  '',
];

// Claves derivadas (usuarios/sucursales vienen de _count, no de una columna real de Empresa) --
// se resuelven acá para que el comparador de abajo no necesite saber de dónde sale cada valor.
function valorOrdenable(empresa, clave) {
  if (clave === 'usuarios') return empresa._count.usuariosEmpresa;
  if (clave === 'sucursales') return empresa._count.sucursales;
  if (clave === 'creadoEn') return new Date(empresa.creadoEn).getTime();
  if (clave === 'vigenciaHasta') return empresa.vigenciaHasta ? new Date(empresa.vigenciaHasta).getTime() : null;
  return empresa[clave];
}

// Vacíos (correo/teléfono sin dato, vigencia sin vencimiento) siempre al final, sin importar la
// dirección -- alternar asc/desc no debería hacer que "sin dato" salte de abajo a arriba.
function compararEmpresas(a, b, clave, orden) {
  const va = valorOrdenable(a, clave);
  const vb = valorOrdenable(b, clave);
  const vacioA = va === null || va === undefined || va === '';
  const vacioB = vb === null || vb === undefined || vb === '';
  if (vacioA || vacioB) {
    if (vacioA && vacioB) return 0;
    return vacioA ? 1 : -1;
  }
  if (typeof va === 'string') {
    return orden === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  }
  return orden === 'asc' ? va - vb : vb - va;
}

function SuperAdminPage() {
  const { usuario, logout } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [actualizandoId, setActualizandoId] = useState(null);
  const [orden, setOrden] = useState({ ordenarPor: 'creadoEn', orden: 'desc' });

  function handleOrdenar(clave) {
    setOrden((o) => (o.ordenarPor === clave
      ? { ordenarPor: clave, orden: o.orden === 'asc' ? 'desc' : 'asc' }
      : { ordenarPor: clave, orden: 'asc' }));
  }

  const empresasOrdenadas = useMemo(() => {
    const copia = [...empresas];
    copia.sort((a, b) => compararEmpresas(a, b, orden.ordenarPor, orden.orden));
    return copia;
  }, [empresas, orden]);

  // El Excel lleva Teléfono/Correo y Usuarios/Sucursales por separado aunque en pantalla vayan
  // combinados (ver COLUMNAS) -- acá no hay límite de ancho, mejor dejar el dato completo.
  async function exportarExcelAccion() {
    const { exportarExcel } = await import('../../../shared/xlsx');
    const columnasExport = [
      { label: 'Número', clave: 'numero' },
      { label: 'Empresa', clave: 'nombreComercial' },
      { label: 'Teléfono', clave: 'telefono' },
      { label: 'Correo', clave: 'correo' },
      { label: 'Usuarios', clave: 'usuarios' },
      { label: 'Sucursales', clave: 'sucursales' },
      { label: 'Plan', clave: 'plan' },
      { label: 'Alta', clave: 'creadoEn' },
      { label: 'Vigencia', clave: 'vigenciaHasta' },
      { label: 'Estado', clave: 'estado' },
    ];
    const filas = empresasOrdenadas.map((e) => ({
      numero: formatoNumeroEmpresa(e.numero),
      nombreComercial: e.nombreComercial,
      telefono: e.telefono || '',
      correo: e.correo || '',
      plan: e.plan,
      creadoEn: new Date(e.creadoEn).toLocaleDateString('es-MX'),
      vigenciaHasta: e.vigenciaHasta ? new Date(e.vigenciaHasta).toLocaleDateString('es-MX') : 'Sin vencimiento',
      estado: e.estado,
      usuarios: e._count.usuariosEmpresa,
      sucursales: e._count.sucursales,
    }));
    exportarExcel('empresas-boxpos.xlsx', filas, columnasExport);
  }

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Empresas</h2>
            <p className="text-sm text-gray-500">
              Suspender corta el acceso de inmediato, incluidas sesiones abiertas — dejá la
              vigencia vacía para que no tenga vencimiento. Clic en un encabezado para ordenar.
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={exportarExcelAccion} disabled={empresas.length === 0}>
            <FileSpreadsheet size={16} /> Exportar a Excel
          </Button>
        </div>

        {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}

        <Card>
          <Table columnas={COLUMNAS} ordenarPor={orden.ordenarPor} orden={orden.orden} onOrdenar={handleOrdenar}>
            {!cargando && empresas.length === 0 && <TablaVacia colSpan={9} />}
            {empresasOrdenadas.map((e) => {
              const vencida = e.vigenciaHasta && new Date(e.vigenciaHasta) < new Date();
              return (
                <Fila key={e.id}>
                  <Celda className="font-mono text-xs text-gray-500">{formatoNumeroEmpresa(e.numero)}</Celda>
                  <Celda className="font-medium text-gray-800">{e.nombreComercial}</Celda>
                  <Celda>
                    <div>{e.telefono || '—'}</div>
                    {e.correo && <div className="text-xs text-gray-400">{e.correo}</div>}
                  </Celda>
                  <Celda>{e._count.usuariosEmpresa} / {e._count.sucursales}</Celda>
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
