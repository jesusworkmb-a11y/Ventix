import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { listarVentas, cancelarVenta, obtenerVenta } from '../api/ventas.api';
import { crearDevolucion } from '../api/devoluciones.api';
import { listarCajas, listarSesiones } from '../../caja/api/caja.api';
import { listarUsuarios } from '../../core/api/core.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';
import Modal from '../../../shared/ui/Modal';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { formatoMoneda } from '../../../shared/format';

const MOTIVOS_DEVOLUCION = ['Producto defectuoso', 'Error de venta', 'Cliente cambió de opinión', 'Garantía', 'Otro'];

const ESTADO_TONO = { CONFIRMADA: 'success', CANCELADA: 'gray' };

function VentasHistorialPage() {
  const [ventas, setVentas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cajas, setCajas] = useState([]);
  const [sesionesAbiertas, setSesionesAbiertas] = useState([]);
  const [error, setError] = useState('');

  const [devolviendoId, setDevolviendoId] = useState(null);
  const [ventaDevolucion, setVentaDevolucion] = useState(null);
  const [devArticuloId, setDevArticuloId] = useState('');
  const [devCantidad, setDevCantidad] = useState('1');
  const [devVuelveAStock, setDevVuelveAStock] = useState(true);
  const [devCarrito, setDevCarrito] = useState([]);
  const [devMotivo, setDevMotivo] = useState(MOTIVOS_DEVOLUCION[0]);
  const [devAutorizadoPorId, setDevAutorizadoPorId] = useState('');
  const [devError, setDevError] = useState('');

  useEffect(() => {
    cargarVentas();
    listarUsuarios().then(setUsuarios).catch(() => {});
    listarCajas().then(setCajas).catch(() => {});
    listarSesiones({ abierta: 'true' }).then(setSesionesAbiertas).catch(() => {});
  }, []);

  function cargarVentas() {
    listarVentas().then(setVentas).catch(() => {});
  }

  // Una devolución con reembolso necesita una sesión de caja abierta de la MISMA sucursal
  // que la venta original (así lo exige registrarMovimientoCaja en el backend) — se resuelve
  // sola en vez de pedirle al usuario que elija la caja correcta a mano.
  function sesionParaSucursal(sucursalId) {
    const cajaIds = cajas.filter((c) => c.sucursalId === sucursalId).map((c) => c.id);
    return sesionesAbiertas.find((s) => cajaIds.includes(s.cajaId)) || null;
  }

  async function handleCancelar(ventaId) {
    setError('');
    try {
      await cancelarVenta(ventaId);
      cargarVentas();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cancelar la venta.');
    }
  }

  async function abrirDevolucion(venta) {
    setDevError('');
    setDevCarrito([]);
    setDevMotivo(MOTIVOS_DEVOLUCION[0]);
    setDevAutorizadoPorId('');
    setDevolviendoId(venta.id);
    try {
      const detalle = await obtenerVenta(venta.id);
      setVentaDevolucion(detalle);
    } catch (err) {
      setDevError('No se pudo cargar el detalle de la venta.');
    }
  }

  function cerrarDevolucion() {
    setDevolviendoId(null);
    setVentaDevolucion(null);
    setDevCarrito([]);
  }

  function agregarLineaDevolucion(e) {
    e.preventDefault();
    const linea = ventaDevolucion?.detalles.find((d) => d.articuloId === devArticuloId);
    if (!linea) return;
    const yaEnCarrito = devCarrito
      .filter((l) => l.articuloId === devArticuloId)
      .reduce((acc, l) => acc + l.cantidad, 0);
    const disponible = Number(linea.cantidad) - Number(linea.cantidadDevuelta) - yaEnCarrito;
    const cant = Number(devCantidad);
    if (cant <= 0 || cant > disponible) {
      setDevError(`Cantidad inválida (disponible para devolver: ${disponible}).`);
      return;
    }
    setDevError('');
    setDevCarrito((c) => [
      ...c,
      {
        articuloId: devArticuloId,
        nombre: linea.articulo?.nombre || devArticuloId,
        cantidad: cant,
        precio: Number(linea.precio),
        impuestoTasa: Number(linea.impuestoTasa),
        vuelveAStock: devVuelveAStock,
      },
    ]);
    setDevArticuloId('');
    setDevCantidad('1');
  }

  function quitarLineaDevolucion(index) {
    setDevCarrito((c) => c.filter((_, i) => i !== index));
  }

  const devReembolso = Math.round(
    devCarrito.reduce((acc, l) => acc + l.cantidad * l.precio * (1 + l.impuestoTasa), 0) * 100,
  ) / 100;

  async function confirmarDevolucion(e) {
    e.preventDefault();
    setDevError('');
    if (devCarrito.length === 0) {
      setDevError('Agrega al menos un artículo a devolver.');
      return;
    }
    if (!devAutorizadoPorId) {
      setDevError('Selecciona quién autoriza la devolución.');
      return;
    }
    const sesion = sesionParaSucursal(ventaDevolucion.sucursalId);
    if (devReembolso > 0 && !sesion) {
      setDevError('Esta devolución implica un reembolso; abre una sesión de caja para la sucursal de esta venta primero.');
      return;
    }
    try {
      await crearDevolucion({
        ventaId: ventaDevolucion.id,
        motivo: devMotivo,
        autorizadoPorId: devAutorizadoPorId,
        sesionCajaId: devReembolso > 0 ? sesion.id : undefined,
        detalles: devCarrito.map((l) => ({
          articuloId: l.articuloId,
          cantidad: l.cantidad,
          vuelveAStock: l.vuelveAStock,
        })),
      });
      cerrarDevolucion();
      cargarVentas();
    } catch (err) {
      setDevError(err.response?.data?.error || 'No se pudo procesar la devolución.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas recientes</h1>
          <p className="text-sm text-gray-500">Historial de ventas, cancelaciones y devoluciones.</p>
        </div>
        <Link
          to="/ventas"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Volver a Ventas
        </Link>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}

      <Card>
        <Table columnas={['Folio', 'Cliente', 'Total', 'Estado', '']}>
          {ventas.length === 0 && <TablaVacia colSpan={5} />}
          {ventas.map((v) => (
            <Fila key={v.id}>
              <Celda className="font-medium text-gray-800">{v.folio}</Celda>
              <Celda>{v.cliente?.nombre}</Celda>
              <Celda>{formatoMoneda(v.total)}</Celda>
              <Celda><Badge tono={ESTADO_TONO[v.estado] || 'gray'}>{v.estado}</Badge></Celda>
              <Celda className="text-right">
                {v.estado === 'CONFIRMADA' && (
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => handleCancelar(v.id)} className="text-sm text-danger-600 hover:underline">
                      Cancelar
                    </button>
                    <button type="button" onClick={() => abrirDevolucion(v)} className="text-sm text-primary-600 hover:underline">
                      Devolver
                    </button>
                  </div>
                )}
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <Modal abierto={devolviendoId !== null} onCerrar={cerrarDevolucion} titulo="Registrar devolución" ancho="max-w-2xl">
        {devError && <p className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{devError}</p>}
        {!ventaDevolucion && <p className="text-sm text-gray-500">Cargando detalle de la venta…</p>}
        {ventaDevolucion && (
          <>
            <form onSubmit={agregarLineaDevolucion} className="flex flex-wrap items-end gap-3">
              <Select
                id="devArticulo"
                label="Artículo vendido"
                value={devArticuloId}
                onChange={(e) => setDevArticuloId(e.target.value)}
                required
                className="min-w-[220px]"
              >
                <option value="">Selecciona un artículo...</option>
                {ventaDevolucion.detalles.map((d) => (
                  <option key={d.articuloId} value={d.articuloId}>
                    {d.articulo?.nombre || d.articuloId} (disponible: {Number(d.cantidad) - Number(d.cantidadDevuelta)})
                  </option>
                ))}
              </Select>
              <Input
                id="devCantidad"
                label="Cantidad"
                type="number"
                step="0.01"
                min="0.01"
                value={devCantidad}
                onChange={(e) => setDevCantidad(e.target.value)}
                className="w-28"
                required
              />
              <label className="flex items-center gap-2 pb-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={devVuelveAStock}
                  onChange={(e) => setDevVuelveAStock(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Vuelve a stock
              </label>
              <Button type="submit" variant="secondary">Agregar</Button>
            </form>

            {devCarrito.length > 0 && (
              <div className="mt-4">
                <Table columnas={['Artículo', 'Cantidad', 'Vuelve a stock', '']}>
                  {devCarrito.map((l, i) => (
                    <Fila key={i}>
                      <Celda>{l.nombre}</Celda>
                      <Celda>{l.cantidad}</Celda>
                      <Celda>{l.vuelveAStock ? 'Sí' : 'No'}</Celda>
                      <Celda className="text-right">
                        <button type="button" onClick={() => quitarLineaDevolucion(i)} className="text-gray-400 hover:text-danger-600">
                          <Trash2 size={16} />
                        </button>
                      </Celda>
                    </Fila>
                  ))}
                </Table>
              </div>
            )}

            <form onSubmit={confirmarDevolucion} className="mt-4 flex flex-wrap items-end gap-3">
              <Select
                id="devMotivo"
                label="Motivo"
                value={devMotivo}
                onChange={(e) => setDevMotivo(e.target.value)}
              >
                {MOTIVOS_DEVOLUCION.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
              <Select
                id="devAutorizadoPor"
                label="Autoriza"
                value={devAutorizadoPorId}
                onChange={(e) => setDevAutorizadoPorId(e.target.value)}
                required
              >
                <option value="">Selecciona quién autoriza...</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </Select>
              <span className="pb-2 text-sm font-medium text-gray-700">Reembolso: {formatoMoneda(devReembolso)}</span>
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="secondary" onClick={cerrarDevolucion}>Cancelar</Button>
                <Button type="submit">Confirmar devolución</Button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </div>
  );
}

export default VentasHistorialPage;
