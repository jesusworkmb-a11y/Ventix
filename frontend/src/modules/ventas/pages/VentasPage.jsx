import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trash2, Search, Plus, Minus, Package, UserPlus, CreditCard,
  ArrowLeftRight, Layers,
} from 'lucide-react';
import { listarVentas, crearVenta, cancelarVenta, obtenerVenta } from '../api/ventas.api';
import { crearDevolucion } from '../api/devoluciones.api';
import { listarCajas, listarSesiones } from '../../caja/api/caja.api';
import { listarClientes, crearCliente } from '../../clientes/api/clientes.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';
import { listarExistencias } from '../../inventario/api/inventario.api';
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
  const [existencias, setExistencias] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [error, setError] = useState('');
  const [confirmada, setConfirmada] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const busquedaRef = useRef(null);

  const [nuevoClienteAbierto, setNuevoClienteAbierto] = useState(false);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState('');
  const [nuevoClienteTelefono, setNuevoClienteTelefono] = useState('');
  const [nuevoClienteError, setNuevoClienteError] = useState('');

  const [mixtoAbierto, setMixtoAbierto] = useState(false);
  const [mixtoPagos, setMixtoPagos] = useState([
    { metodo: 'EFECTIVO', monto: '' },
    { metodo: 'TARJETA', monto: '' },
  ]);
  const [mixtoError, setMixtoError] = useState('');

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

  useEffect(() => {
    const caja = cajas.find((c) => c.id === cajaId);
    if (!caja) return;
    listarExistencias({ sucursalId: caja.sucursalId })
      .then((data) => {
        const mapa = {};
        data.forEach((e) => { mapa[e.articuloId] = Number(e.cantidad); });
        setExistencias(mapa);
      })
      .catch(() => {});
  }, [cajaId, cajas]);

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

  // Agregar directo al carrito (clic en la tarjeta o Enter en el buscador) — sin botón
  // "Agregar" intermedio: si el artículo ya está en el carrito, solo suma 1 a esa línea.
  function agregarAlCarrito(articulo) {
    setError('');
    setCarrito((c) => {
      const idx = c.findIndex((l) => l.articuloId === articulo.id);
      if (idx !== -1) {
        const copia = [...c];
        copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + 1 };
        return copia;
      }
      const impuestoTasa = articulo.impuesto ? Number(articulo.impuesto.tasa) : 0;
      return [
        ...c,
        {
          articuloId: articulo.id,
          nombre: articulo.nombre,
          cantidad: 1,
          precio: precioEfectivo(articulo),
          impuestoTasa,
        },
      ];
    });
  }

  function cambiarCantidadLinea(index, delta) {
    setCarrito((c) => {
      const linea = c[index];
      const nueva = linea.cantidad + delta;
      if (nueva <= 0) return c.filter((_, i) => i !== index);
      const copia = [...c];
      copia[index] = { ...linea, cantidad: nueva };
      return copia;
    });
  }

  function quitarLinea(index) {
    setCarrito((c) => c.filter((_, i) => i !== index));
  }

  function limpiarVenta() {
    setCarrito([]);
    setError('');
    setConfirmada(null);
  }

  const categorias = [...new Map(
    articulos.filter((a) => a.categoria).map((a) => [a.categoria.id, a.categoria]),
  ).values()];

  const articulosFiltrados = articulos.filter((a) => {
    if (!a.activo) return false;
    if (categoriaFiltro && a.categoriaId !== categoriaFiltro) return false;
    if (!busqueda.trim()) return true;
    const texto = busqueda.trim().toLowerCase();
    return (
      a.nombre.toLowerCase().includes(texto) ||
      (a.sku || '').toLowerCase().includes(texto) ||
      (a.codigoBarras || '').toLowerCase().includes(texto)
    );
  });

  // Escaneo por código de barras: al presionar Enter, si hay una coincidencia exacta de
  // código/SKU o el filtro dejó un solo resultado, se agrega directo sin más clics.
  function handleBusquedaKeyDown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return;
    const exacto = articulos.find(
      (a) => a.activo && ((a.codigoBarras || '').toLowerCase() === texto || (a.sku || '').toLowerCase() === texto),
    );
    if (exacto) {
      agregarAlCarrito(exacto);
      setBusqueda('');
      return;
    }
    if (articulosFiltrados.length === 1) {
      agregarAlCarrito(articulosFiltrados[0]);
      setBusqueda('');
    }
  }

  const subtotal = carrito.reduce((acc, l) => acc + l.cantidad * l.precio, 0);
  const impuestos = carrito.reduce((acc, l) => acc + l.cantidad * l.precio * l.impuestoTasa, 0);
  const total = Math.round((subtotal + impuestos) * 100) / 100;

  // Cobrar en un clic: cada botón de método de pago llama esto directo con el monto total,
  // sin paso intermedio de "seleccionar método" + "confirmar". Mixto es la excepción, ver
  // confirmarPagoMixto más abajo.
  async function cobrar(metodo) {
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
    if (procesando) return;
    setProcesando(true);
    const caja = cajas.find((c) => c.id === cajaId);
    try {
      const venta = await crearVenta({
        sucursalId: caja.sucursalId,
        clienteId,
        sesionCajaId: sesion.id,
        detalles: carrito.map((l) => ({ articuloId: l.articuloId, cantidad: l.cantidad })),
        pagos: [{ metodo, monto: total }],
      });
      setConfirmada(venta);
      setCarrito([]);
      cargarVentas();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la venta.');
    } finally {
      setProcesando(false);
    }
  }

  function abrirMixto() {
    if (carrito.length === 0) {
      setError('Agrega al menos un artículo.');
      return;
    }
    setMixtoError('');
    setMixtoPagos([
      { metodo: 'EFECTIVO', monto: total.toFixed(2) },
      { metodo: 'TARJETA', monto: '0.00' },
    ]);
    setMixtoAbierto(true);
  }

  function cambiarMixtoPago(index, campo, valor) {
    setMixtoPagos((p) => {
      const copia = [...p];
      copia[index] = { ...copia[index], [campo]: valor };
      return copia;
    });
  }

  const mixtoSuma = mixtoPagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

  async function confirmarPagoMixto(e) {
    e.preventDefault();
    setMixtoError('');
    if (!sesion) {
      setMixtoError('No hay una sesión de caja abierta para esta caja.');
      return;
    }
    const pagosValidos = mixtoPagos.filter((p) => Number(p.monto) > 0);
    if (pagosValidos.length === 0) {
      setMixtoError('Ingresa al menos un monto.');
      return;
    }
    if (Math.round(mixtoSuma * 100) !== Math.round(total * 100)) {
      setMixtoError(`La suma de los pagos (${formatoMoneda(mixtoSuma)}) debe ser igual al total (${formatoMoneda(total)}).`);
      return;
    }
    if (procesando) return;
    setProcesando(true);
    const caja = cajas.find((c) => c.id === cajaId);
    try {
      const venta = await crearVenta({
        sucursalId: caja.sucursalId,
        clienteId,
        sesionCajaId: sesion.id,
        detalles: carrito.map((l) => ({ articuloId: l.articuloId, cantidad: l.cantidad })),
        pagos: pagosValidos.map((p) => ({ metodo: p.metodo, monto: Number(p.monto) })),
      });
      setConfirmada(venta);
      setCarrito([]);
      cargarVentas();
      setMixtoAbierto(false);
    } catch (err) {
      setMixtoError(err.response?.data?.error || 'No se pudo registrar la venta.');
    } finally {
      setProcesando(false);
    }
  }

  function abrirNuevoCliente() {
    setNuevoClienteError('');
    setNuevoClienteNombre('');
    setNuevoClienteTelefono('');
    setNuevoClienteAbierto(true);
  }

  async function confirmarNuevoCliente(e) {
    e.preventDefault();
    setNuevoClienteError('');
    if (!nuevoClienteNombre.trim()) {
      setNuevoClienteError('El nombre es obligatorio.');
      return;
    }
    try {
      const cliente = await crearCliente({
        nombre: nuevoClienteNombre.trim(),
        telefono: nuevoClienteTelefono.trim() || undefined,
      });
      setClientes((c) => [...c, cliente]);
      setClienteId(cliente.id);
      setNuevoClienteAbierto(false);
    } catch (err) {
      setNuevoClienteError(err.response?.data?.error || 'No se pudo crear el cliente.');
    }
  }

  const hayModalAbierto = devolviendoId !== null || nuevoClienteAbierto || mixtoAbierto;

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'F1') {
        e.preventDefault();
        if (!hayModalAbierto) cobrar('EFECTIVO');
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        busquedaRef.current?.focus();
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        if (!hayModalAbierto) abrirNuevoCliente();
        return;
      }
      if (e.key === 'Escape' && !hayModalAbierto) {
        if (busqueda) {
          setBusqueda('');
        } else if (carrito.length > 0) {
          limpiarVenta();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayModalAbierto, busqueda, carrito, sesion, cajaId, clienteId, total, procesando]);

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
            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={busquedaRef}
                    type="text"
                    autoFocus
                    placeholder="Escanear código o buscar producto... (F2)"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    onKeyDown={handleBusquedaKeyDown}
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {categorias.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCategoriaFiltro('')}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium ${categoriaFiltro === '' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      Todos
                    </button>
                    {categorias.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setCategoriaFiltro(c.id)}
                        className={`rounded-full px-3 py-1.5 text-sm font-medium ${categoriaFiltro === c.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {c.nombre}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {articulosFiltrados.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => agregarAlCarrito(a)}
                      className="flex flex-col items-start rounded-xl border border-gray-200 bg-white p-3 text-left transition-colors hover:border-primary-400 hover:bg-primary-50"
                    >
                      <div className="mb-2 flex h-16 w-full items-center justify-center rounded-lg bg-gray-100">
                        {a.imagenUrl ? (
                          <img src={a.imagenUrl} alt="" className="h-full w-full rounded-lg object-cover" />
                        ) : (
                          <Package size={22} className="text-gray-400" />
                        )}
                      </div>
                      <span className="line-clamp-2 text-sm font-medium text-gray-800">{a.nombre}</span>
                      <span className="mt-1 text-sm font-semibold text-primary-700">{formatoMoneda(precioEfectivo(a))}</span>
                      <span className="text-xs text-gray-400">Stock: {existencias[a.id] ?? 0}</span>
                    </button>
                  ))}
                  {articulosFiltrados.length === 0 && (
                    <p className="col-span-full py-8 text-center text-sm text-gray-400">No se encontraron productos.</p>
                  )}
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 lg:sticky lg:top-4">
                  <div className="flex items-end gap-2">
                    <Select
                      id="cliente"
                      label="Cliente"
                      value={clienteId}
                      onChange={(e) => setClienteId(e.target.value)}
                      className="flex-1"
                    >
                      {clientes.filter((c) => c.activo).map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}{c.esGeneral ? ' (general)' : ''}</option>
                      ))}
                    </Select>
                    <Button type="button" variant="secondary" size="md" onClick={abrirNuevoCliente} title="Nuevo cliente (F3)">
                      <UserPlus size={16} />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">Detalle de venta</h4>
                    {carrito.length > 0 && (
                      <button type="button" onClick={limpiarVenta} className="text-xs font-medium text-gray-400 hover:text-danger-600">
                        Limpiar (Esc)
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {carrito.length === 0 && (
                      <p className="py-6 text-center text-sm text-gray-400">Escanea o selecciona un producto para empezar.</p>
                    )}
                    {carrito.map((l, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg bg-white p-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-gray-800">{l.nombre}</p>
                          <p className="text-xs text-gray-400">{formatoMoneda(l.precio)} c/u</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => cambiarCantidadLinea(i, -1)} className="rounded-md border border-gray-200 p-1 text-gray-500 hover:bg-gray-100">
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center font-medium text-gray-800">{l.cantidad}</span>
                          <button type="button" onClick={() => cambiarCantidadLinea(i, 1)} className="rounded-md border border-gray-200 p-1 text-gray-500 hover:bg-gray-100">
                            <Plus size={14} />
                          </button>
                        </div>
                        <span className="w-16 text-right font-semibold text-gray-900">{formatoMoneda(l.cantidad * l.precio)}</span>
                        <button type="button" onClick={() => quitarLinea(i)} className="text-gray-300 hover:text-danger-600">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1 border-t border-gray-200 pt-3 text-sm">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal</span>
                      <span>{formatoMoneda(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Impuestos</span>
                      <span>{formatoMoneda(impuestos)}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold text-gray-900">
                      <span>Total</span>
                      <span>{formatoMoneda(total)}</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => cobrar('EFECTIVO')}
                    disabled={carrito.length === 0 || procesando}
                    className="w-full py-3 text-base"
                  >
                    Cobrar {formatoMoneda(total)} (F1)
                  </Button>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => cobrar('TARJETA')}
                      disabled={carrito.length === 0 || procesando}
                      className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <CreditCard size={16} /> Tarjeta
                    </button>
                    <button
                      type="button"
                      onClick={() => cobrar('TRANSFERENCIA')}
                      disabled={carrito.length === 0 || procesando}
                      className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <ArrowLeftRight size={16} /> Transf.
                    </button>
                    <button
                      type="button"
                      onClick={abrirMixto}
                      disabled={carrito.length === 0 || procesando}
                      className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <Layers size={16} /> Mixto
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {sesion && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs text-gray-400">
              <span><kbd className="rounded border border-gray-200 px-1.5 py-0.5 font-sans">F1</kbd> Cobrar en efectivo</span>
              <span><kbd className="rounded border border-gray-200 px-1.5 py-0.5 font-sans">F2</kbd> Buscar producto</span>
              <span><kbd className="rounded border border-gray-200 px-1.5 py-0.5 font-sans">F3</kbd> Nuevo cliente</span>
              <span><kbd className="rounded border border-gray-200 px-1.5 py-0.5 font-sans">Esc</kbd> Limpiar venta</span>
            </div>
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

      <Modal abierto={nuevoClienteAbierto} onCerrar={() => setNuevoClienteAbierto(false)} titulo="Nuevo cliente">
        <form onSubmit={confirmarNuevoCliente} className="space-y-4">
          {nuevoClienteError && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{nuevoClienteError}</p>}
          <Input
            id="nuevoClienteNombre"
            label="Nombre"
            value={nuevoClienteNombre}
            onChange={(e) => setNuevoClienteNombre(e.target.value)}
            required
            autoFocus
          />
          <Input
            id="nuevoClienteTelefono"
            label="Teléfono (opcional)"
            value={nuevoClienteTelefono}
            onChange={(e) => setNuevoClienteTelefono(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setNuevoClienteAbierto(false)}>Cancelar</Button>
            <Button type="submit">Crear cliente</Button>
          </div>
        </form>
      </Modal>

      <Modal abierto={mixtoAbierto} onCerrar={() => setMixtoAbierto(false)} titulo="Pago mixto">
        <form onSubmit={confirmarPagoMixto} className="space-y-4">
          {mixtoError && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{mixtoError}</p>}
          <p className="text-sm text-gray-500">Total a cobrar: <span className="font-semibold text-gray-900">{formatoMoneda(total)}</span></p>
          {mixtoPagos.map((p, i) => (
            <div key={i} className="flex items-end gap-3">
              <Select
                id={`mixtoMetodo${i}`}
                label="Método"
                value={p.metodo}
                onChange={(e) => cambiarMixtoPago(i, 'metodo', e.target.value)}
                className="flex-1"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </Select>
              <Input
                id={`mixtoMonto${i}`}
                label="Monto"
                type="number"
                step="0.01"
                min="0"
                value={p.monto}
                onChange={(e) => cambiarMixtoPago(i, 'monto', e.target.value)}
                className="w-32"
              />
            </div>
          ))}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Suma ingresada</span>
            <span className={mixtoSuma.toFixed(2) === total.toFixed(2) ? 'font-medium text-success-700' : 'font-medium text-danger-600'}>
              {formatoMoneda(mixtoSuma)}
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMixtoAbierto(false)}>Cancelar</Button>
            <Button type="submit" disabled={procesando}>Confirmar venta</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default VentasPage;
