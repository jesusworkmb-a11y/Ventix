import { useEffect, useState } from 'react';
import { listarTransferencias, obtenerTransferencia, crearTransferencia, recibirTransferencia } from '../api/transferencias.api';
import { listarSucursales } from '../../core/api/core.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';
import Modal from '../../../shared/ui/Modal';
import Paginacion from '../../../shared/ui/Paginacion';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { Trash2, Search } from 'lucide-react';

const ESTADO_TONO = { EN_TRANSITO: 'warning', RECIBIDA: 'success' };

const COLUMNAS_TRANSFERENCIAS = [
  { label: 'Folio', clave: 'folio', ordenable: true },
  { label: 'Origen → Destino', clave: null },
  { label: 'Estado', clave: 'estado', ordenable: true },
  { label: '', clave: null },
];

function TransferenciasPage() {
  const [sucursales, setSucursales] = useState([]);
  const [sucursalOrigenId, setSucursalOrigenId] = useState('');
  const [sucursalDestinoId, setSucursalDestinoId] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [articuloId, setArticuloId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [carrito, setCarrito] = useState([]);
  const [error, setError] = useState('');
  const [creada, setCreada] = useState(null);
  const [transferencias, setTransferencias] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [orden, setOrden] = useState({ ordenarPor: 'creadoEn', orden: 'desc' });

  const [verDetalleId, setVerDetalleId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [recibirError, setRecibirError] = useState('');

  useEffect(() => {
    listarSucursales()
      .then((data) => {
        setSucursales(data);
        if (data.length) {
          setSucursalOrigenId((actual) => actual || data[0].id);
          setSucursalDestinoId((actual) => actual || (data[1]?.id || data[0].id));
        }
      })
      .catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cargarTransferencias(pagina = 1) {
    listarTransferencias({
      buscar: busqueda || undefined,
      pagina,
      porPagina: 20,
      ordenarPor: orden.ordenarPor,
      orden: orden.orden,
    })
      .then((r) => {
        setTransferencias(r.datos);
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
    cargarTransferencias(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, orden]);

  function nombreSucursal(id) {
    return sucursales.find((s) => s.id === id)?.nombre || id;
  }

  function agregarLinea(e) {
    e.preventDefault();
    const articulo = articulos.find((a) => a.id === articuloId);
    if (!articulo) return;
    setCarrito((c) => [...c, { articuloId, nombre: articulo.nombre, cantidad: Number(cantidad) }]);
    setArticuloId('');
    setCantidad('1');
  }

  function quitarLinea(index) {
    setCarrito((c) => c.filter((_, i) => i !== index));
  }

  async function confirmarTransferencia(e) {
    e.preventDefault();
    setError('');
    setCreada(null);
    if (sucursalOrigenId === sucursalDestinoId) {
      setError('La sucursal de origen y destino deben ser distintas.');
      return;
    }
    if (carrito.length === 0) {
      setError('Agrega al menos un artículo.');
      return;
    }
    try {
      const transferencia = await crearTransferencia({
        sucursalOrigenId,
        sucursalDestinoId,
        detalles: carrito.map((l) => ({ articuloId: l.articuloId, cantidad: l.cantidad })),
      });
      setCreada(transferencia);
      setCarrito([]);
      cargarTransferencias(1);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la transferencia.');
    }
  }

  async function verDetalle(id) {
    setVerDetalleId(id);
    setDetalle(null);
    setRecibirError('');
    try {
      const d = await obtenerTransferencia(id);
      setDetalle(d);
    } catch (err) {
      setDetalle(null);
    }
  }

  async function handleRecibir(id) {
    setRecibirError('');
    try {
      await recibirTransferencia(id);
      cargarTransferencias(paginacion.pagina);
      if (verDetalleId === id) verDetalle(id);
    } catch (err) {
      setRecibirError(err.response?.data?.error || 'No se pudo recibir la transferencia.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Transferencias entre sucursales</h1>
        <p className="text-sm text-gray-500">Movés stock de una sucursal a otra; el destino confirma la recepción.</p>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
      {creada && (
        <p className="rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">
          Transferencia {creada.folio} creada — en tránsito.
        </p>
      )}

      <Card title="Nueva transferencia">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select id="sucursalOrigen" label="Origen" value={sucursalOrigenId} onChange={(e) => setSucursalOrigenId(e.target.value)}>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
          <Select id="sucursalDestino" label="Destino" value={sucursalDestinoId} onChange={(e) => setSucursalDestinoId(e.target.value)}>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
        </div>

        <form onSubmit={agregarLinea} className="mt-5 flex flex-wrap items-end gap-3">
          <Select
            id="articuloTransferencia"
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
            id="cantidadTransferencia"
            label="Cantidad"
            type="number"
            step="0.01"
            min="0.01"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="w-28"
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
                  <Celda>{l.cantidad}</Celda>
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

        <form onSubmit={confirmarTransferencia} className="mt-5">
          <Button type="submit">Crear transferencia</Button>
        </form>
      </Card>

      <Card title="Transferencias recientes">
        {recibirError && <p className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{recibirError}</p>}
        <div className="relative mb-4 max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por folio..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <Table
          columnas={COLUMNAS_TRANSFERENCIAS}
          ordenarPor={orden.ordenarPor}
          orden={orden.orden}
          onOrdenar={handleOrdenar}
          pie={(
            <Paginacion
              pagina={paginacion.pagina}
              totalPaginas={paginacion.totalPaginas}
              total={paginacion.total}
              onCambiar={cargarTransferencias}
            />
          )}
        >
          {transferencias.length === 0 && <TablaVacia colSpan={4} />}
          {transferencias.map((t) => (
            <Fila key={t.id}>
              <Celda className="font-medium text-gray-800">{t.folio}</Celda>
              <Celda>{nombreSucursal(t.sucursalOrigenId)} → {nombreSucursal(t.sucursalDestinoId)}</Celda>
              <Celda><Badge tono={ESTADO_TONO[t.estado] || 'gray'}>{t.estado}</Badge></Celda>
              <Celda className="text-right">
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => verDetalle(t.id)} className="text-sm text-primary-600 hover:underline">
                    Ver líneas
                  </button>
                  {t.estado === 'EN_TRANSITO' && (
                    <button type="button" onClick={() => handleRecibir(t.id)} className="text-sm text-success-700 hover:underline">
                      Recibir
                    </button>
                  )}
                </div>
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <Modal abierto={verDetalleId !== null} onCerrar={() => setVerDetalleId(null)} titulo="Líneas de la transferencia">
        {!detalle && <p className="text-sm text-gray-500">Cargando…</p>}
        {detalle && (
          <ul className="divide-y divide-gray-100">
            {detalle.detalles.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-700">{d.articulo?.nombre || d.articuloId}</span>
                <span className="font-medium text-gray-800">{d.cantidad}</span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

export default TransferenciasPage;
