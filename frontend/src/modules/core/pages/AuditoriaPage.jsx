import { useEffect, useState } from 'react';
import { listarAuditoria, listarUsuarios } from '../api/core.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Paginacion from '../../../shared/ui/Paginacion';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';

const ENTIDADES = ['Empresa', 'Sucursal', 'Usuario', 'Rol', 'RolPermiso'];

const COLUMNAS = [
  { label: 'Fecha', clave: 'creadoEn', ordenable: true },
  { label: 'Usuario', clave: null },
  { label: 'Acción', clave: 'accion', ordenable: true },
  { label: 'Entidad', clave: 'entidad', ordenable: true },
  { label: 'Detalle', clave: null },
];

function AuditoriaPage() {
  const [registros, setRegistros] = useState([]);
  const [usuariosPorId, setUsuariosPorId] = useState({});
  const [filtros, setFiltros] = useState({ entidad: '', desde: '', hasta: '', buscar: '' });
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [orden, setOrden] = useState({ ordenarPor: 'creadoEn', orden: 'desc' });
  const [error, setError] = useState('');

  function cargar(pagina = 1) {
    setError('');
    const params = { pagina, porPagina: 20, ordenarPor: orden.ordenarPor, orden: orden.orden };
    if (filtros.entidad) params.entidad = filtros.entidad;
    if (filtros.buscar) params.buscar = filtros.buscar;
    if (filtros.desde) params.desde = filtros.desde;
    // "Hasta" es solo fecha (input type=date); sin la hora, el backend compararía contra
    // medianoche y excluiría todo lo registrado ese mismo día después de las 00:00.
    if (filtros.hasta) params.hasta = `${filtros.hasta}T23:59:59.999`;
    listarAuditoria(params)
      .then((r) => {
        setRegistros(r.datos);
        setPaginacion({ pagina: r.pagina, totalPaginas: r.totalPaginas, total: r.total });
      })
      .catch((err) => setError(err.response?.data?.error || 'No se pudo cargar la bitácora.'));
  }

  function handleOrdenar(clave) {
    setOrden((o) => (o.ordenarPor === clave
      ? { ordenarPor: clave, orden: o.orden === 'asc' ? 'desc' : 'asc' }
      : { ordenarPor: clave, orden: 'asc' }));
  }

  useEffect(() => {
    listarUsuarios()
      .then((usuarios) => {
        const mapa = {};
        for (const u of usuarios) mapa[u.id] = u.nombre;
        setUsuariosPorId(mapa);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden]);

  function aplicarFiltros(e) {
    e.preventDefault();
    cargar(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bitácora de auditoría</h1>
        <p className="text-sm text-gray-500">Historial de cambios realizados en el sistema.</p>
      </div>

      <Card>
        <form onSubmit={aplicarFiltros} className="flex flex-wrap items-end gap-3">
          <Select
            id="entidadFiltro"
            label="Entidad"
            value={filtros.entidad}
            onChange={(e) => setFiltros((f) => ({ ...f, entidad: e.target.value }))}
            className="min-w-[180px]"
          >
            <option value="">Todas</option>
            {ENTIDADES.map((ent) => (
              <option key={ent} value={ent}>{ent}</option>
            ))}
          </Select>
          <Input
            id="desdeFiltro"
            label="Desde"
            type="date"
            value={filtros.desde}
            onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))}
          />
          <Input
            id="hastaFiltro"
            label="Hasta"
            type="date"
            value={filtros.hasta}
            onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value }))}
          />
          <Input
            id="buscarFolioFiltro"
            label="Folio"
            placeholder="Buscar por folio..."
            value={filtros.buscar}
            onChange={(e) => setFiltros((f) => ({ ...f, buscar: e.target.value }))}
          />
          <Button type="submit" variant="secondary">Filtrar</Button>
        </form>
      </Card>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}

      <Card title="Registros">
        <Table
          columnas={COLUMNAS}
          ordenarPor={orden.ordenarPor}
          orden={orden.orden}
          onOrdenar={handleOrdenar}
          pie={(
            <Paginacion
              pagina={paginacion.pagina}
              totalPaginas={paginacion.totalPaginas}
              total={paginacion.total}
              onCambiar={cargar}
            />
          )}
        >
          {registros.length === 0 && <TablaVacia colSpan={5} mensaje="Sin registros para los filtros seleccionados." />}
          {registros.map((r) => (
            <Fila key={r.id}>
              <Celda>{new Date(r.creadoEn).toLocaleString()}</Celda>
              <Celda>{usuariosPorId[r.usuarioEjecutorId] || r.usuarioEjecutorId}</Celda>
              <Celda>{r.accion}</Celda>
              <Celda>{r.entidad}{r.entidadId ? ` (${r.entidadId.slice(0, 8)}…)` : ''}</Celda>
              <Celda>
                {(r.valoresAntes || r.valoresDespues) ? (
                  <details>
                    <summary className="cursor-pointer text-sm text-primary-600 hover:underline">ver</summary>
                    <div className="mt-2 space-y-2">
                      {r.valoresAntes && (
                        <pre className="max-w-md overflow-x-auto rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
                          Antes: {JSON.stringify(r.valoresAntes, null, 2)}
                        </pre>
                      )}
                      {r.valoresDespues && (
                        <pre className="max-w-md overflow-x-auto rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
                          Después: {JSON.stringify(r.valoresDespues, null, 2)}
                        </pre>
                      )}
                    </div>
                  </details>
                ) : '—'}
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>
    </div>
  );
}

export default AuditoriaPage;
