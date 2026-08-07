import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trash2, Search, Plus, Minus, Package, UserPlus, CreditCard,
  ArrowLeftRight, Layers, Banknote, Printer,
} from 'lucide-react';
import { crearVenta, obtenerVenta } from '../api/ventas.api';
import { listarCajas, listarSesiones } from '../../caja/api/caja.api';
import { listarClientes, crearCliente } from '../../clientes/api/clientes.api';
import { listarArticulos, listarDescuentos, listarPromociones } from '../../catalogo/api/catalogo.api';
import { listarUsuarios } from '../../core/api/core.api';
import { listarExistencias } from '../../inventario/api/inventario.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Modal from '../../../shared/ui/Modal';
import TicketVenta from '../components/TicketVenta';
import { formatoMoneda } from '../../../shared/format';
import { useAuth } from '../../../shared/context/AuthContext';

// Recalcula el descuento/promoción de una línea a partir de su selección (descuentoId o
// promocionId) — misma fórmula que resolverDescuentoLinea en el backend (ventas.service.js),
// para que el total mostrado en el carrito ya sea el que el backend va a confirmar.
function calcularDescuentoLinea(linea, descuentosPorId, promocionesPorId) {
  if (linea.descuentoId) {
    const d = descuentosPorId.get(linea.descuentoId);
    if (!d) return { descuentoMonto: 0, requiereAprobacion: false, descuentoNombre: null };
    const bruto = linea.cantidad * linea.precio;
    const monto = d.tipo === 'PORCENTAJE' ? bruto * (Number(d.valor) / 100) : Math.min(Number(d.valor), bruto);
    return { descuentoMonto: monto, requiereAprobacion: d.requiereAprobacion, descuentoNombre: d.nombre };
  }
  if (linea.promocionId) {
    const p = promocionesPorId.get(linea.promocionId);
    if (!p) return { descuentoMonto: 0, requiereAprobacion: false, descuentoNombre: null };
    const grupos = Math.floor(linea.cantidad / p.cantidadRequerida);
    const monto = grupos * p.cantidadGratis * linea.precio;
    return { descuentoMonto: monto, requiereAprobacion: p.requiereAprobacion, descuentoNombre: p.nombre };
  }
  return { descuentoMonto: 0, requiereAprobacion: false, descuentoNombre: null };
}

function vigente(item) {
  const ahora = new Date();
  if (item.vigenciaDesde && ahora < new Date(item.vigenciaDesde)) return false;
  if (item.vigenciaHasta && ahora > new Date(item.vigenciaHasta)) return false;
  return true;
}

function VentasPage() {
  const { permisos } = useAuth();
  const puedeAplicarDescuento = permisos?.includes('venta.aplicar_descuento');

  const [cajas, setCajas] = useState([]);
  const [cajaId, setCajaId] = useState('');
  const [sesion, setSesion] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [existencias, setExistencias] = useState({});
  const [descuentos, setDescuentos] = useState([]);
  const [promociones, setPromociones] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [error, setError] = useState('');
  const [confirmada, setConfirmada] = useState(null);
  const [ultimoCambio, setUltimoCambio] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const busquedaRef = useRef(null);

  // Autorización de Supervisor: se pide una sola vez por venta si algún descuento/promoción
  // del carrito lo requiere (ver requiereAprobacion en descuentos/promociones); se recuerda
  // qué acción se quería hacer (cobrar en efectivo, tarjeta, etc.) para retomarla al confirmar.
  const [autorizadoPorId, setAutorizadoPorId] = useState('');
  const [autorizarAbierto, setAutorizarAbierto] = useState(false);
  const [autorizarSeleccion, setAutorizarSeleccion] = useState('');
  const [autorizarError, setAutorizarError] = useState('');
  const accionPendienteRef = useRef(null);

  const [ticketVenta, setTicketVenta] = useState(null);
  const [ticketAbierto, setTicketAbierto] = useState(false);

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

  const [efectivoAbierto, setEfectivoAbierto] = useState(false);
  const [efectivoRecibido, setEfectivoRecibido] = useState('');
  const [efectivoError, setEfectivoError] = useState('');

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
    if (puedeAplicarDescuento) {
      listarDescuentos().then(setDescuentos).catch(() => {});
      listarPromociones().then(setPromociones).catch(() => {});
    }
    listarUsuarios().then(setUsuarios).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          descuentoId: null,
          promocionId: null,
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

  // value viene del <select> de la línea: "" (sin descuento), "descuento:<id>" o "promocion:<id>".
  function cambiarDescuentoLinea(index, value) {
    const [tipo, id] = value.split(':');
    setCarrito((c) => {
      const copia = [...c];
      copia[index] = {
        ...copia[index],
        descuentoId: tipo === 'descuento' ? id : null,
        promocionId: tipo === 'promocion' ? id : null,
      };
      return copia;
    });
  }

  // Descuentos/promociones cuyo alcance (todos/categoría/artículo) matchea el artículo de la
  // línea y que están activos y vigentes — mismas reglas que resolverDescuentoLinea en el backend.
  function opcionesDescuentoParaLinea(linea) {
    const articulo = articulos.find((a) => a.id === linea.articuloId);
    if (!articulo) return [];
    const aplica = (item) => {
      if (!item.activo || !vigente(item)) return false;
      if (item.alcance === 'CATEGORIA') return item.categoriaId === articulo.categoriaId;
      if (item.alcance === 'ARTICULO') return item.articuloId === articulo.id;
      return true; // TODOS
    };
    const opciones = [];
    for (const d of descuentos) {
      if (aplica(d)) {
        opciones.push({
          value: `descuento:${d.id}`,
          label: `${d.nombre} (${d.tipo === 'PORCENTAJE' ? `${Number(d.valor)}%` : formatoMoneda(d.valor)})`,
        });
      }
    }
    for (const p of promociones) {
      if (aplica(p)) {
        opciones.push({
          value: `promocion:${p.id}`,
          label: `${p.nombre} (lleva ${p.cantidadRequerida}, paga ${p.cantidadRequerida - p.cantidadGratis})`,
        });
      }
    }
    return opciones;
  }

  function limpiarVenta() {
    setCarrito([]);
    setError('');
    setConfirmada(null);
    setAutorizadoPorId('');
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

  const descuentosPorId = new Map(descuentos.map((d) => [d.id, d]));
  const promocionesPorId = new Map(promociones.map((p) => [p.id, p]));
  const carritoCalc = carrito.map((l) => ({ ...l, ...calcularDescuentoLinea(l, descuentosPorId, promocionesPorId) }));

  const subtotal = carritoCalc.reduce((acc, l) => acc + (l.cantidad * l.precio - l.descuentoMonto), 0);
  const impuestos = carritoCalc.reduce(
    (acc, l) => acc + (l.cantidad * l.precio - l.descuentoMonto) * l.impuestoTasa,
    0,
  );
  const total = Math.round((subtotal + impuestos) * 100) / 100;
  const requiereAutorizacion = carritoCalc.some((l) => l.requiereAprobacion);

  // Envuelve una acción de cobro: si el carrito tiene un descuento/promoción que requiere
  // aprobación y todavía no se eligió un autorizador, abre el modal "Autorizar" y guarda la
  // acción para retomarla apenas se confirme; si no hace falta, la ejecuta directo.
  function conAutorizacionSiHaceFalta(accion) {
    if (requiereAutorizacion && !autorizadoPorId) {
      accionPendienteRef.current = accion;
      setAutorizarError('');
      setAutorizarSeleccion('');
      setAutorizarAbierto(true);
      return;
    }
    accion();
  }

  function confirmarAutorizar(e) {
    e.preventDefault();
    if (!autorizarSeleccion) {
      setAutorizarError('Selecciona quién autoriza.');
      return;
    }
    setAutorizadoPorId(autorizarSeleccion);
    setAutorizarAbierto(false);
    const accion = accionPendienteRef.current;
    accionPendienteRef.current = null;
    if (accion) accion();
  }

  // Cobrar en un clic: cada botón de método de pago llama esto directo con el monto total,
  // sin paso intermedio de "seleccionar método" + "confirmar". Efectivo pasa antes por el
  // modal de "Recibido" (para calcular cambio) y Mixto por confirmarPagoMixto más abajo.
  async function cobrar(metodo, cambio = null) {
    setError('');
    setConfirmada(null);
    setUltimoCambio(null);
    if (!sesion) {
      setError('No hay una sesión de caja abierta para esta caja.');
      return false;
    }
    if (carrito.length === 0) {
      setError('Agrega al menos un artículo.');
      return false;
    }
    if (procesando) return false;
    setProcesando(true);
    const caja = cajas.find((c) => c.id === cajaId);
    try {
      const venta = await crearVenta({
        sucursalId: caja.sucursalId,
        clienteId,
        sesionCajaId: sesion.id,
        detalles: carrito.map((l) => ({
          articuloId: l.articuloId,
          cantidad: l.cantidad,
          ...(l.descuentoId && { descuentoId: l.descuentoId }),
          ...(l.promocionId && { promocionId: l.promocionId }),
        })),
        pagos: [{ metodo, monto: total }],
        ...(autorizadoPorId && { autorizadoPorId }),
      });
      setConfirmada(venta);
      setUltimoCambio(cambio);
      setTicketVenta(null);
      obtenerVenta(venta.id).then(setTicketVenta).catch(() => {});
      setCarrito([]);
      setAutorizadoPorId('');
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la venta.');
      return false;
    } finally {
      setProcesando(false);
    }
  }

  // Efectivo pasa por un modal aparte para poder ingresar cuánto entregó el cliente y
  // calcular el cambio — el monto que se registra como pago sigue siendo el total exacto,
  // el cambio es solo informativo (el backend no lleva ese dato).
  function abrirEfectivo() {
    if (carrito.length === 0) {
      setError('Agrega al menos un artículo.');
      return;
    }
    setEfectivoError('');
    setEfectivoRecibido(total.toFixed(2));
    setEfectivoAbierto(true);
  }

  const efectivoCambio = Math.round(((Number(efectivoRecibido) || 0) - total) * 100) / 100;

  async function confirmarEfectivo(e) {
    e.preventDefault();
    setEfectivoError('');
    const recibido = Number(efectivoRecibido);
    if (!recibido || recibido < total) {
      setEfectivoError('El monto recibido debe ser al menos el total.');
      return;
    }
    const ok = await cobrar('EFECTIVO', efectivoCambio);
    if (ok) setEfectivoAbierto(false);
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
        detalles: carrito.map((l) => ({
          articuloId: l.articuloId,
          cantidad: l.cantidad,
          ...(l.descuentoId && { descuentoId: l.descuentoId }),
          ...(l.promocionId && { promocionId: l.promocionId }),
        })),
        pagos: pagosValidos.map((p) => ({ metodo: p.metodo, monto: Number(p.monto) })),
        ...(autorizadoPorId && { autorizadoPorId }),
      });
      setConfirmada(venta);
      setUltimoCambio(null);
      setTicketVenta(null);
      obtenerVenta(venta.id).then(setTicketVenta).catch(() => {});
      setCarrito([]);
      setAutorizadoPorId('');
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

  const hayModalAbierto = nuevoClienteAbierto || mixtoAbierto || efectivoAbierto || autorizarAbierto;

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'F1') {
        e.preventDefault();
        if (!hayModalAbierto) conAutorizacionSiHaceFalta(abrirEfectivo);
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
  }, [hayModalAbierto, busqueda, carrito, sesion, cajaId, clienteId, total, procesando, requiereAutorizacion, autorizadoPorId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
          <p className="text-sm text-gray-500">Capturá ventas rápido — escaneá, cobrá y listo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/ventas/recientes"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Ver ventas recientes
          </Link>
          <Link
            to="/ventas/cotizaciones"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Ver cotizaciones
          </Link>
        </div>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
      {confirmada && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">
          <p>
            Venta {confirmada.folio} registrada. Total: {formatoMoneda(confirmada.total)}
            {ultimoCambio > 0 && <> · Cambio: <span className="font-semibold">{formatoMoneda(ultimoCambio)}</span></>}
          </p>
          <button
            type="button"
            onClick={() => setTicketAbierto(true)}
            disabled={!ticketVenta}
            className="inline-flex items-center gap-1.5 font-medium text-success-800 hover:underline disabled:opacity-50 disabled:no-underline"
          >
            <Printer size={15} /> Imprimir ticket
          </button>
        </div>
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
                    {carritoCalc.map((l, i) => {
                      const opcionesDescuento = puedeAplicarDescuento ? opcionesDescuentoParaLinea(l) : [];
                      return (
                        <div key={i} className="rounded-lg bg-white p-2 text-sm">
                          <div className="flex items-center gap-2">
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
                            <span className="w-16 text-right font-semibold text-gray-900">
                              {formatoMoneda(l.cantidad * l.precio - l.descuentoMonto)}
                            </span>
                            <button type="button" onClick={() => quitarLinea(i)} className="text-gray-300 hover:text-danger-600">
                              <Trash2 size={15} />
                            </button>
                          </div>
                          {opcionesDescuento.length > 0 && (
                            <select
                              value={l.descuentoId ? `descuento:${l.descuentoId}` : l.promocionId ? `promocion:${l.promocionId}` : ''}
                              onChange={(e) => cambiarDescuentoLinea(i, e.target.value)}
                              className="mt-1.5 w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                              <option value="">Sin descuento/promoción</option>
                              {opcionesDescuento.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          )}
                          {l.descuentoMonto > 0 && (
                            <p className="mt-1 text-xs text-success-700">
                              {l.descuentoNombre}: -{formatoMoneda(l.descuentoMonto)}
                              {l.requiereAprobacion ? ' (requiere aprobación)' : ''}
                            </p>
                          )}
                        </div>
                      );
                    })}
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

                  {requiereAutorizacion && (
                    <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
                      Esta venta incluye un descuento/promoción que requiere autorización de un
                      Supervisor{autorizadoPorId ? ` — autorizada por ${usuarios.find((u) => u.id === autorizadoPorId)?.nombre || ''}.` : ' antes de confirmar.'}
                    </p>
                  )}

                  <Button
                    type="button"
                    onClick={() => conAutorizacionSiHaceFalta(abrirEfectivo)}
                    disabled={carrito.length === 0 || procesando}
                    className="w-full py-3 text-base"
                  >
                    <Banknote size={18} /> Cobrar {formatoMoneda(total)} (F1)
                  </Button>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => conAutorizacionSiHaceFalta(() => cobrar('TARJETA'))}
                      disabled={carrito.length === 0 || procesando}
                      className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <CreditCard size={16} /> Tarjeta
                    </button>
                    <button
                      type="button"
                      onClick={() => conAutorizacionSiHaceFalta(() => cobrar('TRANSFERENCIA'))}
                      disabled={carrito.length === 0 || procesando}
                      className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <ArrowLeftRight size={16} /> Transf.
                    </button>
                    <button
                      type="button"
                      onClick={() => conAutorizacionSiHaceFalta(abrirMixto)}
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

      <Modal abierto={efectivoAbierto} onCerrar={() => setEfectivoAbierto(false)} titulo="Cobro en efectivo">
        <form onSubmit={confirmarEfectivo} className="space-y-4">
          {efectivoError && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{efectivoError}</p>}
          <p className="text-sm text-gray-500">Total a cobrar: <span className="font-semibold text-gray-900">{formatoMoneda(total)}</span></p>
          <Input
            id="efectivoRecibido"
            label="Recibido"
            type="number"
            step="0.01"
            min="0"
            value={efectivoRecibido}
            onChange={(e) => setEfectivoRecibido(e.target.value)}
            autoFocus
            onFocus={(e) => e.target.select()}
          />
          <div className="flex justify-between text-base">
            <span className="font-medium text-gray-700">Cambio</span>
            <span className={`font-semibold ${efectivoCambio < 0 ? 'text-danger-600' : 'text-success-700'}`}>
              {formatoMoneda(Math.max(efectivoCambio, 0))}
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEfectivoAbierto(false)}>Cancelar</Button>
            <Button type="submit" disabled={procesando}>Confirmar cobro</Button>
          </div>
        </form>
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

      <Modal abierto={autorizarAbierto} onCerrar={() => setAutorizarAbierto(false)} titulo="Autorización de Supervisor">
        <form onSubmit={confirmarAutorizar} className="space-y-4">
          {autorizarError && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{autorizarError}</p>}
          <p className="text-sm text-gray-500">
            Esta venta incluye un descuento/promoción que requiere autorización de un Supervisor
            antes de confirmarse.
          </p>
          <Select
            id="autorizarSeleccion"
            label="Autoriza"
            value={autorizarSeleccion}
            onChange={(e) => setAutorizarSeleccion(e.target.value)}
            autoFocus
          >
            <option value="">Selecciona quién autoriza</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAutorizarAbierto(false)}>Cancelar</Button>
            <Button type="submit">Confirmar autorización</Button>
          </div>
        </form>
      </Modal>

      <Modal abierto={ticketAbierto} onCerrar={() => setTicketAbierto(false)} titulo="Ticket de venta" ancho="max-w-sm">
        <TicketVenta venta={ticketVenta} cambio={ultimoCambio} />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setTicketAbierto(false)}>Cerrar</Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default VentasPage;
