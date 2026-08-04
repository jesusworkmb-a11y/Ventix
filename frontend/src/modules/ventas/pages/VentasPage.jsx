import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { listarVentas, crearVenta, cancelarVenta, obtenerVenta } from '../api/ventas.api';
import { crearDevolucion } from '../api/devoluciones.api';
import { listarCajas, listarSesiones } from '../../caja/api/caja.api';
import { listarClientes } from '../../clientes/api/clientes.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';
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

function VentasPage() {
  const [cajas, setCajas] = useState([]);
  const [cajaId, setCajaId] = useState('');
  const [sesion, setSesion] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [articuloId, setArticuloId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [carrito, setCarrito] = useState([]);
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [error, setError] = useState('');
  const [confirmada, setConfirmada] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

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
    listarCajas()
      .then((data) => {
        setCajas(data);
        if (data.length) setCajaId((actual) => actual || data[0].id);
      })
      .catch(() => {});
    listarClientes()
      .then((data) => {
        setClientes(data);
        const general = data.find((c) => c.esGeneral);
        setClienteId((actual) => actual || (general ? general.id : ''));
      })
      .catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
    listarUsuarios().then(setUsuarios).catch(() => {});
    cargarVentas();
  }, []);

  useEffect(() => {
    if (cajaId) verificarSesion(cajaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cajaId]);

  function cargarVentas() {
    listarVentas().then(setVentas).catch(() => {});
  }

  async function verificarSesion(id) {
    try {
      const abiertas = await listarSesiones({ cajaId: id, abierta: 'true' });
      setSesion(abiertas[0] || null);
    } catch (err) {
      setSesion(null);
    }
  }

  // Precio efectivo para el cliente seleccionado: el de su lista de precio si el artículo
  // tiene uno definido ahí, si no el precio base — misma resolución que ventas.service.js
  // en el backend (lo que se muestra aquí es lo que realmente se va a cobrar).
  function precioEfectivo(articulo) {
    const cliente = clientes.find((c) => c.id === clienteId);
    if (cliente?.listaPrecioId) {
      const porLista = (articulo.precios || []).find((p) => p.listaPrecioId === cliente.listaPrecioId);
      if (porLista) return Number(porLista.precio);
    }
    return Number(articulo.precio);
  }

  function agregarLinea(e) {
    e.preventDefault();
    const articulo = articulos.find((a) => a.id === articuloId);
    if (!articulo) return;
    const impuestoTasa = articulo.impuesto ? Number(articulo.impuesto.tasa) : 0;
    setCarrito((c) => [
      ...c,
      {
        articuloId,
        nombre: articulo.nombre,
        cantidad: Number(cantidad),
        precio: precioEfectivo(articulo),
        impuestoTasa,
      },
    ]);
    setArticuloId('');
    setCantidad('1');
  }

  function quitarLinea(index) {
    setCarrito((c) => c.filter((_, i) => i !== index));
  }

  const subtotal = carrito.reduce((acc, l) => acc + l.cantidad * l.precio, 0);
  const impuestos = carrito.reduce((acc, l) => acc + l.cantidad * l.precio * l.impuestoTasa, 0);
  const total = Math.round((subtotal + impuestos) * 100) / 100;

  async function confirmarVenta(e) {
    e.preventDefault();
    setError('');
    setConfirmada(null);
    if (!sesion) {
      setError('No hay una sesión de caja abierta para esta caja.');
      return;
    }
    if (carrito.length === 0) {
      setError('Agrega al menos un artículo.');
      return;
    }
    const caja = cajas.find((c) => c.id === cajaId);
    try {
      const venta = await crearVenta({
        sucursalId: caja.sucursalId,
        clienteId,
        sesionCajaId: sesion.id,
        detalles: carrito.map((l) => ({ articuloId: l.articuloId, cantidad: l.cantidad })),
        pagos: [{ metodo: metodoPago, monto: total }],
      });
      setConfirmada(venta);
      setCarrito([]);
      cargarVentas();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la venta.');
    }
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
    if (devReembolso > 0 && !sesion) {
      setDevError('Esta devolución implica un reembolso; abre una sesión de caja para esta caja primero.');
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
          <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
          <p className="text-sm text-gray-500">Registrá ventas y gestioná cancelaciones y devoluciones.</p>
        </div>
        <Link
          to="/ventas/cotizaciones"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Ver cotizaciones
        </Link>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
      {confirmada && (
        <p className="rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">
          Venta {confirmada.folio} registrada. Total: {formatoMoneda(confirmada.total)}
        </p>
      )}

      {cajas.length === 0 && (
        <Card>
          <p className="text-sm text-gray-500">No hay cajas registradas todavía (créalas vía la API).</p>
        </Card>
      )}

      {cajas.length > 0 && (
        <Card title="Nueva venta">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select id="caja" label="Caja" value={cajaId} onChange={(e) => setCajaId(e.target.value)}>
              {cajas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </Select>
            {sesion && (
              <Select id="cliente" label="Cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                {clientes.filter((c) => c.activo).map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}{c.esGeneral ? ' (general)' : ''}</option>
                ))}
              </Select>
            )}
          </div>

          {cajaId && !sesion && (
            <p className="mt-4 rounded-lg bg-warning-50 px-4 py-2.5 text-sm text-warning-700">
              Esta caja no tiene una sesión abierta. <Link to="/caja" className="font-medium underline">Abre una en Caja</Link> antes de vender.
            </p>
          )}

          {sesion && (
            <>
              <form onSubmit={agregarLinea} className="mt-5 flex flex-wrap items-end gap-3">
                <Select
                  id="articulo"
                  label="Artículo"
                  value={articuloId}
                  onChange={(e) => setArticuloId(e.target.value)}
                  required
                  className="min-w-[220px]"
                >
                  <option value="">Selecciona un artículo...</option>
                  {articulos.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre} ({formatoMoneda(precioEfectivo(a))})</option>
                  ))}
                </Select>
                <Input
                  id="cantidad"
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
                  <Table columnas={['Artículo', 'Cantidad', 'Precio', '']}>
                    {carrito.map((l, i) => (
                      <Fila key={i}>
                        <Celda>{l.nombre}</Celda>
                        <Celda>{l.cantidad}</Celda>
                        <Celda>{formatoMoneda(l.precio)}</Celda>
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

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3 text-sm">
                <span className="text-gray-500">
                  Subtotal: <span className="font-medium text-gray-700">{formatoMoneda(subtotal)}</span>
                  {' · '}Impuestos: <span className="font-medium text-gray-700">{formatoMoneda(impuestos)}</span>
                </span>
                <span className="text-base font-semibold text-gray-900">Total: {formatoMoneda(total)}</span>
              </div>

              <form onSubmit={confirmarVenta} className="mt-4 flex flex-wrap items-end gap-3">
                <Select
                  id="metodoPago"
                  label="Método de pago"
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="MIXTO">Mixto</option>
                </Select>
                <Button type="submit">Confirmar venta</Button>
              </form>
            </>
          )}
        </Card>
      )}

      <Card title="Ventas recientes">
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

export default VentasPage;
