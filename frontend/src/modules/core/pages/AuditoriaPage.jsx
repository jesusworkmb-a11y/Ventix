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

const ETIQUETAS_CAMPO = {
  nombre: 'Nombre',
  correo: 'Correo',
  telefono: 'Teléfono',
  rolId: 'Rol',
  estado: 'Estado',
  plan: 'Plan',
  activo: 'Activo',
  vigenciaHasta: 'Vigencia',
  direccion: 'Dirección',
  codigoPostal: 'Código postal',
  razonSocial: 'Razón social',
  rfc: 'RFC',
};

function etiquetaCampo(clave) {
  return ETIQUETAS_CAMPO[clave]
    || clave.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function esObjetoPlano(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function formatearValor(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (Array.isArray(v)) {
    if (!v.length) return '—';
    return v.map((item) => (esObjetoPlano(item) ? JSON.stringify(item) : String(item))).join(', ');
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const fecha = new Date(v);
    return Number.isNaN(fecha.getTime()) ? v : fecha.toLocaleString();
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// Reemplaza el volcado crudo de JSON por una lista legible campo: antes → después.
// Cubre el caso más común (diff de pares campo-valor); para valores que no son un objeto plano
// (ej. el arreglo de claves de permiso en RolPermiso) cae a mostrar antes/después como listas.
function DetalleAuditoria({ valoresAntes, valoresDespues }) {
  if (!esObjetoPlano(valoresAntes) && !esObjetoPlano(valoresDespues)) {
    return (
      <div className="space-y-1">
        {valoresAntes !== null && valoresAntes !== undefined && (
          <div><span className="font-medium text-gray-700">Antes:</span> {formatearValor(valoresAntes)}</div>
        )}
        {valoresDespues !== null && valoresDespues !== undefined && (
          <div><span className="font-medium text-gray-700">Después:</span> {formatearValor(valoresDespues)}</div>
        )}
      </div>
    );
  }

  const claves = [...new Set([
    ...(esObjetoPlano(valoresAntes) ? Object.keys(valoresAntes) : []),
    ...(esObjetoPlano(valoresDespues) ? Object.keys(valoresDespues) : []),
  ])];

  return (
    <ul className="space-y-1">
      {claves.map((clave) => {
        const tieneAntes = esObjetoPlano(valoresAntes) && Object.prototype.hasOwnProperty.call(valoresAntes, clave);
        const tieneDespues = esObjetoPlano(valoresDespues) && Object.prototype.hasOwnProperty.call(valoresDespues, clave);
        const antes = tieneAntes ? valoresAntes[clave] : undefined;
        const despues = tieneDespues ? valoresDespues[clave] : undefined;
        const cambio = tieneAntes && tieneDespues && JSON.stringify(antes) !== JSON.stringify(despues);
        return (
          <li key={clave}>
            <span className="font-medium text-gray-700">{etiquetaCampo(clave)}:</span>{' '}
            {cambio
              ? `${formatearValor(antes)} → ${formatearValor(despues)}`
              : formatearValor(tieneDespues ? despues : antes)}
          </li>
        );
      })}
    </ul>
  );
}

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
                    <div className="mt-2 max-w-md rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
                      <DetalleAuditoria valoresAntes={r.valoresAntes} valoresDespues={r.valoresDespues} />
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
