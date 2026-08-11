import { useEffect, useState } from 'react';
import { Search, FileDown } from 'lucide-react';
import { listarCompras, obtenerCompra, crearCompra, cancelarCompra } from '../api/compras.api';
import { listarProveedores } from '../../proveedores/api/proveedores.api';
import { listarSucursales } from '../../core/api/core.api';
import { listarArticulos, listarUnidades } from '../../catalogo/api/catalogo.api';
import { useAuth } from '../../../shared/context/AuthContext';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';
import Paginacion from '../../../shared/ui/Paginacion';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { formatoMoneda } from '../../../shared/format';

const FORM_VACIO = {
  proveedorId: '',
  sucursalId: '',
  articuloId: '',
  unidadId: '',
  cantidad: '',
  costo: '',
};

const ESTADO_TONO = { CONFIRMADA: 'success', CANCELADA: 'gray' };

const COLUMNAS = [
  { label: 'Folio', clave: 'folio', ordenable: true },
  { label: 'Proveedor', clave: 'proveedor', ordenable: true },
  { label: 'Sucursal', clave: null },
  { label: 'Total', clave: 'total', ordenable: true },
  { label: 'Estado', clave: 'estado', ordenable: true },
  { label: '', clave: null },
];

function ComprasPage() {
  const { empresa } = useAuth();
  const [compras, setCompras] = useState([]);
  const [errorPdf, setErrorPdf] = useState('');
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState({ ordenarPor: 'creadoEn', orden: 'desc' });
  const [proveedores, setProveedores] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');

  function cargarCompras(pagina = 1) {
    listarCompras({
      buscar: busqueda || undefined,
      pagina,
      porPagina: 20,
      ordenarPor: orden.ordenarPor,
      orden: orden.orden,
    })
      .then((r) => {
        setCompras(r.datos);
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
    listarProveedores().then(setProveedores).catch(() => {});
    listarSucursales().then(setSucursales).catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
    listarUnidades().then(setUnidades).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarCompras(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, orden]);

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  // jsPDF (+ sus dependencias, ~250kB gzip) solo se descarga cuando alguien realmente pide un
  // PDF, vía import() dinámico, mismo criterio que CotizacionesPage#descargarPdf.
  async function descargarPdf(compraId) {
    setErrorPdf('');
    try {
      const [detalle, { generarPdfCompra }] = await Promise.all([
        obtenerCompra(compraId),
        import('../pdf/compraPdf'),
      ]);
      generarPdfCompra(detalle, empresa);
    } catch (err) {
      setErrorPdf('No se pudo generar el PDF de la compra.');
    }
  }

  async function handleCancelar(compraId) {
    setError('');
    try {
      await cancelarCompra(compraId);
      cargarCompras(paginacion.pagina);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cancelar la compra.');
    }
  }

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      await crearCompra({
        proveedorId: form.proveedorId,
        sucursalId: form.sucursalId,
        detalles: [
          {
            articuloId: form.articuloId,
            unidadId: form.unidadId,
            cantidad: Number(form.cantidad),
            costo: Number(form.costo),
          },
        ],
      });
      setForm(FORM_VACIO);
      cargarCompras(1);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la compra.');
    }
  }

  const articuloSeleccionado = articulos.find((a) => a.id === form.articuloId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
        <p className="text-sm text-gray-500">Registrá compras a proveedores y gestioná cancelaciones.</p>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}

      <Card>
        <div className="relative max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por folio o proveedor..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </Card>

      <Card title="Compras recientes">
        {errorPdf && <p className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{errorPdf}</p>}
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
              onCambiar={cargarCompras}
            />
          )}
        >
          {compras.length === 0 && <TablaVacia colSpan={6} />}
          {compras.map((c) => (
            <Fila key={c.id}>
              <Celda className="font-medium text-gray-800">{c.folio}</Celda>
              <Celda>{c.proveedor?.nombre}</Celda>
              <Celda>{c.sucursal?.nombre}</Celda>
              <Celda>{formatoMoneda(c.total)}</Celda>
              <Celda><Badge tono={ESTADO_TONO[c.estado] || 'gray'}>{c.estado}</Badge></Celda>
              <Celda className="text-right">
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => descargarPdf(c.id)}
                    className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 hover:underline"
                    title="Descargar PDF"
                  >
                    <FileDown size={14} /> PDF
                  </button>
                  {c.estado === 'CONFIRMADA' && (
                    <button type="button" onClick={() => handleCancelar(c.id)} className="text-sm text-danger-600 hover:underline">
                      Cancelar
                    </button>
                  )}
                </div>
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <Card title="Nueva compra">
        <p className="mb-4 text-sm text-gray-500">Una línea por compra desde aquí. Para varias líneas, usa la API.</p>
        <form onSubmit={agregar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select id="proveedorId" label="Proveedor" value={form.proveedorId} onChange={(e) => actualizarCampo('proveedorId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {proveedores.filter((p) => p.activo).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
          <Select id="sucursalId" label="Sucursal" value={form.sucursalId} onChange={(e) => actualizarCampo('sucursalId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
          <Select
            id="articuloIdCompra"
            label="Artículo"
            value={form.articuloId}
            onChange={(e) => {
              const articulo = articulos.find((a) => a.id === e.target.value);
              setForm((f) => ({ ...f, articuloId: e.target.value, unidadId: articulo?.unidadBaseId || '' }));
            }}
            required
          >
            <option value="">Selecciona...</option>
            {articulos.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </Select>
          <Select id="unidadId" label="Unidad" value={form.unidadId} onChange={(e) => actualizarCampo('unidadId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {articuloSeleccionado && (
              <option value={articuloSeleccionado.unidadBaseId}>{articuloSeleccionado.unidadBase?.nombre} (base)</option>
            )}
            {(articuloSeleccionado?.unidadesAlternas || []).map((u) => (
              <option key={u.unidadId} value={u.unidadId}>
                {u.unidad?.nombre} (=&nbsp;{Number(u.factor)}&nbsp;{articuloSeleccionado?.unidadBase?.nombre})
              </option>
            ))}
          </Select>
          <Input
            id="cantidadCompra"
            label="Cantidad"
            type="number"
            step="0.01"
            min="0"
            value={form.cantidad}
            onChange={(e) => actualizarCampo('cantidad', e.target.value)}
            required
          />
          <Input
            id="costoCompra"
            label="Costo por unidad"
            type="number"
            step="0.01"
            min="0"
            value={form.costo}
            onChange={(e) => actualizarCampo('costo', e.target.value)}
            required
          />
          <div className="sm:col-span-2">
            <Button type="submit">Registrar compra</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default ComprasPage;
