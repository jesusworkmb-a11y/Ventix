import { useEffect, useState } from 'react';
import { listarAjustes, obtenerAjuste, crearAjuste } from '../api/ajustes.api';
import { listarSucursales } from '../../core/api/core.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';
import { listarUsuarios } from '../../core/api/core.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Modal from '../../../shared/ui/Modal';
import Paginacion from '../../../shared/ui/Paginacion';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { Trash2, Search } from 'lucide-react';

const COLUMNAS_AJUSTES = [
  { label: 'Folio', clave: 'folio', ordenable: true },
  { label: 'Motivo', clave: 'motivo', ordenable: true },
  { label: 'Fecha', clave: 'creadoEn', ordenable: true },
  { label: '', clave: null },
];

function AjustesPage() {
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [articuloId, setArticuloId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [motivo, setMotivo] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [autorizadoPorId, setAutorizadoPorId] = useState('');
  const [error, setError] = useState('');
  const [creado, setCreado] = useState(null);
  const [ajustes, setAjustes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [orden, setOrden] = useState({ ordenarPor: 'creadoEn', orden: 'desc' });

  const [verDetalleId, setVerDetalleId] = useState(null);
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    listarSucursales()
      .then((data) => {
        setSucursales(data);
        if (data.length) setSucursalId((actual) => actual || data[0].id);
      })
      .catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
    listarUsuarios().then(setUsuarios).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cargarAjustes(pagina = 1) {
    listarAjustes({
      buscar: busqueda || undefined,
      pagina,
      porPagina: 20,
      ordenarPor: orden.ordenarPor,
      orden: orden.orden,
    })
      .then((r) => {
        setAjustes(r.datos);
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
    cargarAjustes(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, orden]);

  function agregarLinea(e) {
    e.preventDefault();
    const articulo = articulos.find((a) => a.id === articuloId);
    if (!articulo) return;
    const cant = Number(cantidad);
    if (!cant) {
      setError('La cantidad no puede ser 0.');
      return;
    }
    setError('');
    setCarrito((c) => [...c, { articuloId, nombre: articulo.nombre, cantidad: cant }]);
    setArticuloId('');
    setCantidad('');
  }

  function quitarLinea(index) {
    setCarrito((c) => c.filter((_, i) => i !== index));
  }

  async function confirmarAjuste(e) {
    e.preventDefault();
    setError('');
    setCreado(null);
    if (carrito.length === 0) {
      setError('Agrega al menos un artículo.');
      return;
    }
    try {
      const ajuste = await crearAjuste({
        sucursalId,
        motivo,
        autorizadoPorId: autorizadoPorId || undefined,
        detalles: carrito.map((l) => ({ articuloId: l.articuloId, cantidad: l.cantidad })),
      });
      setCreado(ajuste);
      setCarrito([]);
      setMotivo('');
      cargarAjustes(1);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar el ajuste.');
    }
  }

  async function verDetalle(id) {
    setVerDetalleId(id);
    setDetalle(null);
    try {
      const d = await obtenerAjuste(id);
      setDetalle(d);
    } catch (err) {
      setDetalle(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ajustes de inventario</h1>
        <p className="text-sm text-gray-500">Corregí existencias por caducidad, daño, robo u otro motivo.</p>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
      {creado && (
        <p className="rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">Ajuste {creado.folio} registrado.</p>
      )}

      <Card title="Nuevo ajuste">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select id="sucursalAjuste" label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
          <Input id="motivoAjuste" label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
        </div>

        <form onSubmit={agregarLinea} className="mt-5 flex flex-wrap items-end gap-3">
          <Select
            id="articuloAjuste"
            label="Artículo"
            value={articuloId}
            onChange={(e) => setArticuloId(e.target.value)}
            required
            className="min-w-[220px]"
          >
            <option value="">Selecciona un artículo...</option>
            {articulos.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </Select>
          <Input
            id="cantidadAjuste"
            label="Cantidad (+ entra, - sale)"
            type="number"
            step="0.01"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="w-48"
            required
          />
          <Button type="submit" variant="secondary">Agregar</Button>
        </form>

        {carrito.length > 0 && (
          <div className="mt-4">
            <Table columnas={['Artículo', 'Cantidad', '']}>
              {carrito.map((l, i) => (
                <Fila key={i}>
                  <Celda>{l.nombre}</Celda>
                  <Celda>{l.cantidad > 0 ? `+${l.cantidad}` : l.cantidad}</Celda>
                  <Celda className="text-right">
                    <button type="button" onClick={() => quitarLinea(i)} className="text-gray-400 hover:text-danger-600">
                      <Trash2 size={16} />
                    </button>
                  </Celda>
                </Fila>
              ))}
            </Table>
          </div>
        )}

        <form onSubmit={confirmarAjuste} className="mt-5 flex flex-wrap items-end gap-3">
          <Select
            id="autorizaAjuste"
            label="Autoriza (opcional)"
            value={autorizadoPorId}
            onChange={(e) => setAutorizadoPorId(e.target.value)}
            className="min-w-[200px]"
          >
            <option value="">—</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </Select>
          <Button type="submit">Registrar ajuste</Button>
        </form>
      </Card>

      <Card title="Ajustes recientes">
        <div className="relative mb-4 max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por folio o motivo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <Table
          columnas={COLUMNAS_AJUSTES}
          ordenarPor={orden.ordenarPor}
          orden={orden.orden}
          onOrdenar={handleOrdenar}
          pie={(
            <Paginacion
              pagina={paginacion.pagina}
              totalPaginas={paginacion.totalPaginas}
              total={paginacion.total}
              onCambiar={cargarAjustes}
            />
          )}
        >
          {ajustes.length === 0 && <TablaVacia colSpan={4} />}
          {ajustes.map((a) => (
            <Fila key={a.id}>
              <Celda className="font-medium text-gray-800">{a.folio}</Celda>
              <Celda>{a.motivo}</Celda>
              <Celda>{new Date(a.creadoEn).toLocaleString()}</Celda>
              <Celda className="text-right">
                <button type="button" onClick={() => verDetalle(a.id)} className="text-sm text-primary-600 hover:underline">
                  Ver líneas
                </button>
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <Modal abierto={verDetalleId !== null} onCerrar={() => setVerDetalleId(null)} titulo="Líneas del ajuste">
        {!detalle && <p className="text-sm text-gray-500">Cargando…</p>}
        {detalle && (
          <ul className="divide-y divide-gray-100">
            {detalle.detalles.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-700">{d.articulo?.nombre || d.articuloId}</span>
                <span className={Number(d.cantidad) > 0 ? 'font-medium text-success-700' : 'font-medium text-danger-700'}>
                  {Number(d.cantidad) > 0 ? '+' : ''}{d.cantidad}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

export default AjustesPage;
