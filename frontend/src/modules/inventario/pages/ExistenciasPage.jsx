import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Download } from 'lucide-react';
import { listarExistencias, establecerExistenciaInicial, exportarExistencias } from '../api/inventario.api';
import { listarSucursales } from '../../core/api/core.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Paginacion from '../../../shared/ui/Paginacion';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';

const FORM_VACIO = { sucursalId: '', articuloId: '', cantidad: '' };

const COLUMNAS_EXISTENCIAS = [
  { label: 'Sucursal', clave: 'sucursal', ordenable: true },
  { label: 'Artículo', clave: 'articulo', ordenable: true },
  { label: 'SKU', clave: 'sku', ordenable: true },
  { label: 'Cantidad', clave: 'cantidad', ordenable: true },
];

function ExistenciasPage() {
  const location = useLocation();
  const [existencias, setExistencias] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');
  const [buscar, setBuscar] = useState(() => location.state?.buscar || '');
  const [filtroSucursalId, setFiltroSucursalId] = useState('');
  const [soloConStock, setSoloConStock] = useState(false);
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [orden, setOrden] = useState({ ordenarPor: 'sucursal', orden: 'asc' });
  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState('');

  function cargarExistencias(pagina = 1) {
    listarExistencias({
      buscar: buscar || undefined,
      sucursalId: filtroSucursalId || undefined,
      soloConStock: soloConStock || undefined,
      pagina,
      porPagina: 20,
      ordenarPor: orden.ordenarPor,
      orden: orden.orden,
    })
      .then((r) => {
        setExistencias(r.datos);
        setPaginacion({ pagina: r.pagina, totalPaginas: r.totalPaginas, total: r.total });
      })
      .catch(() => {});
  }

  function handleOrdenar(clave) {
    setOrden((o) => (o.ordenarPor === clave
      ? { ordenarPor: clave, orden: o.orden === 'asc' ? 'desc' : 'asc' }
      : { ordenarPor: clave, orden: 'asc' }));
  }

  useEffect(() => {
    listarSucursales().then(setSucursales).catch(() => {});
    // Un artículo tipo Servicio o Kit no lleva inventario directo (backend lo rechaza) — se excluyen acá.
    listarArticulos().then((data) => setArticulos(data.filter((a) => a.tipo !== 'SERVICIO' && a.tipo !== 'KIT'))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarExistencias(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscar, filtroSucursalId, soloConStock, orden]);

  // Exporta exactamente lo que la pantalla tiene filtrado en ese momento (búsqueda/sucursal/
  // solo-con-stock), no un volcado completo aparte — mismos filtros que cargarExistencias().
  async function exportar() {
    setErrorExport('');
    setExportando(true);
    try {
      await exportarExistencias({
        buscar: buscar || undefined,
        sucursalId: filtroSucursalId || undefined,
        soloConStock: soloConStock || undefined,
      });
    } catch (err) {
      setErrorExport('No se pudo exportar el reporte.');
    } finally {
      setExportando(false);
    }
  }

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      await establecerExistenciaInicial({
        sucursalId: form.sucursalId,
        articuloId: form.articuloId,
        cantidad: Number(form.cantidad),
      });
      setForm(FORM_VACIO);
      cargarExistencias(paginacion.pagina);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo establecer la existencia inicial.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Existencias</h1>
        <p className="text-sm text-gray-500">Stock actual por sucursal y artículo.</p>
      </div>

      {articulos.length === 0 && (
        <p className="rounded-lg bg-warning-50 px-4 py-2.5 text-sm text-warning-700">
          Primero da de alta artículos en el <Link to="/catalogo/articulos/nuevo" className="font-medium underline">catálogo</Link>.
        </p>
      )}

      <Card
        title="Existencias por sucursal"
        action={(
          <Button type="button" variant="secondary" size="sm" onClick={exportar} disabled={exportando}>
            <Download size={16} /> {exportando ? 'Exportando...' : 'Exportar CSV'}
          </Button>
        )}
      >
        {errorExport && <p className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{errorExport}</p>}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-[38px] text-gray-400" />
            <Input
              id="buscarExistencia"
              label="Buscar"
              placeholder="Nombre o SKU"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            id="filtroSucursalExistencia"
            label="Sucursal"
            value={filtroSucursalId}
            onChange={(e) => setFiltroSucursalId(e.target.value)}
            className="min-w-[180px]"
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
          <label className="flex items-center gap-2 pb-2.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={soloConStock}
              onChange={(e) => setSoloConStock(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Solo con stock
          </label>
        </div>
        <Table
          columnas={COLUMNAS_EXISTENCIAS}
          ordenarPor={orden.ordenarPor}
          orden={orden.orden}
          onOrdenar={handleOrdenar}
          pie={(
            <Paginacion
              pagina={paginacion.pagina}
              totalPaginas={paginacion.totalPaginas}
              total={paginacion.total}
              onCambiar={cargarExistencias}
            />
          )}
        >
          {existencias.length === 0 && <TablaVacia colSpan={4} />}
          {existencias.map((e) => (
            <Fila key={e.id}>
              <Celda>{e.sucursal?.nombre}</Celda>
              <Celda className="font-medium text-gray-800">{e.articulo?.nombre}</Celda>
              <Celda>{e.articulo?.sku || '—'}</Celda>
              <Celda>{e.cantidad}</Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <Card title="Establecer existencia inicial">
        <p className="mb-4 text-sm text-gray-500">
          Solo para un artículo que todavía no tiene existencia registrada en esa sucursal.
          Para corregir una existencia ya en uso, hacé un ajuste.
        </p>
        <form onSubmit={agregar} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select id="sucursalExistencia" label="Sucursal" value={form.sucursalId} onChange={(e) => actualizarCampo('sucursalId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
          <Select id="articuloExistencia" label="Artículo" value={form.articuloId} onChange={(e) => actualizarCampo('articuloId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {articulos.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </Select>
          <Input
            id="cantidadExistencia"
            label="Cantidad"
            type="number"
            step="0.01"
            min="0"
            value={form.cantidad}
            onChange={(e) => actualizarCampo('cantidad', e.target.value)}
            required
          />
          {error && <p className="sm:col-span-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
          <div className="sm:col-span-3">
            <Button type="submit">Establecer existencia</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default ExistenciasPage;
