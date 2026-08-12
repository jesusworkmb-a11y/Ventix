import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, FileDown, Search, Percent, Mail } from 'lucide-react';
import {
  listarCotizaciones, obtenerCotizacion, crearCotizacion, convertirCotizacion, enviarCotizacionPorCorreo,
} from '../api/cotizaciones.api';
import { listarCajas, listarSesiones } from '../../caja/api/caja.api';
import { listarClientes } from '../../clientes/api/clientes.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';
import { listarUsuarios } from '../../core/api/core.api';
import { useAuth } from '../../../shared/context/AuthContext';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';
import Modal from '../../../shared/ui/Modal';
import EnviarCorreoModal from '../../../shared/ui/EnviarCorreoModal';
import Paginacion from '../../../shared/ui/Paginacion';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { formatoMoneda } from '../../../shared/format';

const COLUMNAS_COTIZACIONES = [
  { label: 'Folio', clave: 'folio', ordenable: true },
  { label: 'Total', clave: 'total', ordenable: true },
  { label: 'Estado', clave: null },
  { label: '', clave: null },
];

// Cotizaciones no consume el catálogo de Descuentos/Promociones (a diferencia de Ventas) —
// solo un descuento manual por línea, %/monto fijo, sin permiso para cargarse (ver
// cotizaciones.service.js#calcularDescuentoManual, mismo cálculo del lado del backend).
function calcularDescuentoLinea(linea) {
  if (!linea.descuentoManual) return 0;
  const { tipo, valor } = linea.descuentoManual;
  const bruto = linea.cantidad * linea.precio;
  return tipo === 'PORCENTAJE' ? bruto * (Number(valor) / 100) : Math.min(Number(valor), bruto);
}

function CotizacionesPage() {
  const { empresa } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [articuloId, setArticuloId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [carrito, setCarrito] = useState([]);
  const [error, setError] = useState('');
  const [creada, setCreada] = useState(null);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [orden, setOrden] = useState({ ordenarPor: 'creadoEn', orden: 'desc' });

  // Mini-formulario inline de descuento manual por línea — mismo patrón que VentasPage.
  const [manualEditIndex, setManualEditIndex] = useState(null);
  const [manualForm, setManualForm] = useState({ tipo: 'PORCENTAJE', valor: '' });

  const [cajas, setCajas] = useState([]);
  const [cajaId, setCajaId] = useState('');
  const [sesion, setSesion] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [convirtiendoId, setConvirtiendoId] = useState(null);
  const [convTotal, setConvTotal] = useState(null);
  const [convMetodoPago, setConvMetodoPago] = useState('EFECTIVO');
  const [convRequiereAutorizacion, setConvRequiereAutorizacion] = useState(false);
  const [convAutorizadoPorId, setConvAutorizadoPorId] = useState('');
  const [convError, setConvError] = useState('');

  const [envioCotizacionId, setEnvioCotizacionId] = useState(null);
  const [envioCotizacion, setEnvioCotizacion] = useState(null);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [errorEnvioCorreo, setErrorEnvioCorreo] = useState('');
  const [exitoEnvioCorreo, setExitoEnvioCorreo] = useState('');

  useEffect(() => {
    listarClientes()
      .then((data) => {
        setClientes(data);
        const general = data.find((c) => c.esGeneral);
        setClienteId((actual) => actual || (general ? general.id : ''));
      })
      .catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
    listarCajas()
      .then((data) => {
        setCajas(data);
        if (data.length) setCajaId((actual) => actual || data[0].id);
      })
      .catch(() => {});
    listarUsuarios().then(setUsuarios).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cajaId) verificarSesion(cajaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cajaId]);

  function cargarCotizaciones(pagina = 1) {
    listarCotizaciones({
      buscar: busqueda || undefined,
      pagina,
      porPagina: 20,
      ordenarPor: orden.ordenarPor,
      orden: orden.orden,
    })
      .then((r) => {
        setCotizaciones(r.datos);
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
    cargarCotizaciones(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, orden]);

  // jsPDF (+ sus dependencias, ~250kB gzip) solo se descarga cuando alguien realmente pide un
  // PDF, vía import() dinámico, para no engordar el bundle inicial de toda la app por una
  // función que se usa solo en esta pantalla.
  async function descargarPdf(cotizacionId) {
    setError('');
    try {
      const [detalle, { generarPdfCotizacion }] = await Promise.all([
        obtenerCotizacion(cotizacionId),
        import('../pdf/cotizacionPdf'),
      ]);
      generarPdfCotizacion(detalle, empresa, articulos);
    } catch (err) {
      setError('No se pudo generar el PDF de la cotización.');
    }
  }

  // Reusa el detalle completo de la cotización (mismo obtenerCotizacion que descargarPdf) tanto
  // para prellenar el destinatario sugerido (cliente.correo, puede venir vacío) como para armar
  // el PDF recién al confirmar el envío.
  async function abrirEnvioCorreo(cotizacionId) {
    setError('');
    setErrorEnvioCorreo('');
    setExitoEnvioCorreo('');
    try {
      const detalle = await obtenerCotizacion(cotizacionId);
      setEnvioCotizacion(detalle);
      setEnvioCotizacionId(cotizacionId);
    } catch (err) {
      setError('No se pudo cargar la cotización para enviarla.');
    }
  }

  function cerrarEnvioCorreo() {
    setEnvioCotizacionId(null);
    setEnvioCotizacion(null);
  }

  async function enviarCorreoCotizacion(destinatario, asunto, mensaje) {
    setEnviandoCorreo(true);
    setErrorEnvioCorreo('');
    try {
      const { generarBase64Cotizacion } = await import('../pdf/cotizacionPdf');
      const { base64, nombreArchivo } = generarBase64Cotizacion(envioCotizacion, empresa, articulos);
      await enviarCotizacionPorCorreo(envioCotizacionId, {
        destinatario, asunto, mensaje, adjuntoBase64: base64, nombreArchivo,
      });
      setExitoEnvioCorreo(`Cotización enviada a ${destinatario}.`);
      cerrarEnvioCorreo();
    } catch (err) {
      setErrorEnvioCorreo(err.response?.data?.error || 'No se pudo enviar el correo.');
    } finally {
      setEnviandoCorreo(false);
    }
  }

  async function verificarSesion(id) {
    try {
      const abiertas = await listarSesiones({ cajaId: id, abierta: 'true' });
      setSesion(abiertas[0] || null);
    } catch (err) {
      setSesion(null);
    }
  }

  // Misma resolución de precio por lista que Ventas (ver VentasPage#precioEfectivo) — así el
  // total de la cotización coincide con lo que se cobrará al convertirla.
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
    setCarrito((c) => [
      ...c,
      { articuloId, nombre: articulo.nombre, cantidad: Number(cantidad), precio: precioEfectivo(articulo), descuentoManual: null },
    ]);
    setArticuloId('');
    setCantidad('1');
  }

  // Si borrar una línea corre los índices, el mini-formulario de descuento manual (identificado
  // por índice) tiene que seguir a la línea correcta — mismo criterio que VentasPage.
  function reindexarDescuentoManual(indexEliminado) {
    setManualEditIndex((idx) => {
      if (idx === null) return idx;
      if (idx === indexEliminado) return null;
      if (idx > indexEliminado) return idx - 1;
      return idx;
    });
  }

  function quitarLinea(index) {
    setCarrito((c) => c.filter((_, i) => i !== index));
    reindexarDescuentoManual(index);
  }

  function abrirDescuentoManual(index) {
    const linea = carrito[index];
    setManualForm(linea.descuentoManual ? { ...linea.descuentoManual } : { tipo: 'PORCENTAJE', valor: '' });
    setManualEditIndex(index);
  }

  function cerrarDescuentoManual() {
    setManualEditIndex(null);
  }

  function aplicarDescuentoManual() {
    const valor = Number(manualForm.valor);
    if (!valor || valor <= 0) return;
    setCarrito((c) => {
      const copia = [...c];
      copia[manualEditIndex] = { ...copia[manualEditIndex], descuentoManual: { tipo: manualForm.tipo, valor } };
      return copia;
    });
    setManualEditIndex(null);
  }

  function quitarDescuentoManual(index) {
    setCarrito((c) => {
      const copia = [...c];
      copia[index] = { ...copia[index], descuentoManual: null };
      return copia;
    });
  }

  const carritoCalc = carrito.map((l) => ({ ...l, descuentoMonto: calcularDescuentoLinea(l) }));
  const descuentoTotal = carritoCalc.reduce((acc, l) => acc + l.descuentoMonto, 0);
  const total = Math.round(carritoCalc.reduce((acc, l) => acc + (l.cantidad * l.precio - l.descuentoMonto), 0) * 100) / 100;

  async function confirmarCotizacion(e) {
    e.preventDefault();
    setError('');
    setCreada(null);
    if (carrito.length === 0) {
      setError('Agrega al menos un artículo.');
      return;
    }
    const caja = cajas.find((c) => c.id === cajaId);
    if (!caja) {
      setError('Selecciona una sucursal (vía caja) para la cotización.');
      return;
    }
    try {
      const cotizacion = await crearCotizacion({
        sucursalId: caja.sucursalId,
        clienteId,
        detalles: carritoCalc.map((l) => ({
          articuloId: l.articuloId,
          cantidad: l.cantidad,
          ...(l.descuentoManual && { descuentoManual: { tipo: l.descuentoManual.tipo, valor: Number(l.descuentoManual.valor) } }),
        })),
      });
      setCreada(cotizacion);
      setCarrito([]);
      setManualEditIndex(null);
      cargarCotizaciones(1);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la cotización.');
    }
  }

  // La cotización solo guarda el subtotal (sin impuesto — ver Cotizacion.total en el schema);
  // el impuesto se calcula recién al convertir, con la tasa vigente en ese momento (igual que
  // ventasService.crear). Hay que recalcularlo aquí con el mismo criterio para saber cuánto
  // cobrar antes de convertir, o la suma de pagos no coincide con el total real de la venta.
  // También hay que restar el descuento manual de cada línea antes de aplicar la tasa.
  async function abrirConversion(cotizacionId) {
    setConvError('');
    setConvTotal(null);
    setConvAutorizadoPorId('');
    setConvirtiendoId(cotizacionId);
    try {
      const detalle = await obtenerCotizacion(cotizacionId);
      const totalConImpuesto = detalle.detalles.reduce((acc, d) => {
        const articulo = articulos.find((a) => a.id === d.articuloId);
        const tasa = articulo?.impuesto ? Number(articulo.impuesto.tasa) : 0;
        const neto = Number(d.cantidad) * Number(d.precio) - Number(d.descuentoMonto || 0);
        return acc + neto * (1 + tasa);
      }, 0);
      setConvTotal(Math.round(totalConImpuesto * 100) / 100);
      // Cualquier descuento en una cotización es manual (sin catálogo), y un descuento manual
      // siempre exige autorización de Supervisor al convertir (ver resolverDescuentoLinea).
      setConvRequiereAutorizacion(detalle.detalles.some((d) => Number(d.descuentoMonto) > 0));
    } catch (err) {
      setConvError('No se pudo calcular el total a cobrar.');
    }
  }

  function cerrarConversion() {
    setConvirtiendoId(null);
  }

  async function confirmarConversion(e, cotizacion) {
    e.preventDefault();
    setConvError('');
    if (!sesion) {
      setConvError('No hay una sesión de caja abierta para esta caja.');
      return;
    }
    if (convTotal === null) return;
    if (convRequiereAutorizacion && !convAutorizadoPorId) {
      setConvError('Esta cotización tiene un descuento manual — selecciona quién autoriza.');
      return;
    }
    try {
      await convertirCotizacion(cotizacion.id, {
        sesionCajaId: sesion.id,
        pagos: [{ metodo: convMetodoPago, monto: convTotal }],
        ...(convAutorizadoPorId && { autorizadoPorId: convAutorizadoPorId }),
      });
      setConvirtiendoId(null);
      cargarCotizaciones(paginacion.pagina);
    } catch (err) {
      setConvError(err.response?.data?.error || 'No se pudo convertir la cotización.');
    }
  }

  const cotizacionEnConversion = cotizaciones.find((c) => c.id === convirtiendoId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-sm text-gray-500">Creá cotizaciones y convertilas en venta cuando el cliente confirme.</p>
        </div>
        <Link
          to="/ventas"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Volver a Ventas
        </Link>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
      {exitoEnvioCorreo && <p className="rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">{exitoEnvioCorreo}</p>}
      {creada && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">
          <p>Cotización {creada.folio} creada. Total: {formatoMoneda(creada.total)}</p>
          <button
            type="button"
            onClick={() => descargarPdf(creada.id)}
            className="inline-flex items-center gap-1.5 font-medium text-success-800 hover:underline"
          >
            <FileDown size={15} /> Descargar PDF
          </button>
        </div>
      )}

      <Card title="Nueva cotización">
        <Select id="clienteCot" label="Cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          {clientes.filter((c) => c.activo).map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}{c.esGeneral ? ' (general)' : ''}</option>
          ))}
        </Select>

        <form onSubmit={agregarLinea} className="mt-5 flex flex-wrap items-end gap-3">
          <Select
            id="articuloCot"
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
            id="cantidadCot"
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
            <Table columnas={['Artículo', 'Cantidad', 'Precio', 'Descuento', '']}>
              {carritoCalc.map((l, i) => (
                <Fila key={i}>
                  <Celda>{l.nombre}</Celda>
                  <Celda>{l.cantidad}</Celda>
                  <Celda>{formatoMoneda(l.precio)}</Celda>
                  <Celda>
                    {manualEditIndex === i ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={manualForm.tipo}
                          onChange={(e) => setManualForm((f) => ({ ...f, tipo: e.target.value }))}
                          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                        >
                          <option value="PORCENTAJE">%</option>
                          <option value="MONTO_FIJO">$</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          autoFocus
                          value={manualForm.valor}
                          onChange={(e) => setManualForm((f) => ({ ...f, valor: e.target.value }))}
                          className="w-20 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-900"
                        />
                        <button type="button" onClick={aplicarDescuentoManual} className="rounded-md bg-primary-600 px-2 py-1 text-xs font-medium text-white hover:bg-primary-700">
                          Aplicar
                        </button>
                        <button type="button" onClick={cerrarDescuentoManual} className="text-xs font-medium text-gray-400 hover:text-gray-600">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {l.descuentoMonto > 0 ? (
                          <>
                            <span className="text-xs font-medium text-success-700">-{formatoMoneda(l.descuentoMonto)}</span>
                            <button type="button" onClick={() => abrirDescuentoManual(i)} title="Editar descuento" className="text-primary-600 hover:text-primary-700">
                              <Percent size={14} />
                            </button>
                            <button type="button" onClick={() => quitarDescuentoManual(i)} title="Quitar descuento" className="text-gray-400 hover:text-danger-600">
                              <Trash2 size={13} />
                            </button>
                          </>
                        ) : (
                          <button type="button" onClick={() => abrirDescuentoManual(i)} title="Agregar descuento" className="text-gray-300 hover:text-primary-600">
                            <Percent size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </Celda>
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

        <div className="mt-4 space-y-1 rounded-lg bg-gray-50 px-4 py-3">
          {descuentoTotal > 0 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Descuento</span>
              <span className="font-medium text-success-700">-{formatoMoneda(descuentoTotal)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-gray-900">Total: {formatoMoneda(total)}</span>
          </div>
        </div>

        <form onSubmit={confirmarCotizacion} className="mt-4">
          <Button type="submit">Crear cotización</Button>
        </form>
      </Card>

      <Card title="Convertir en venta">
        {cajas.length > 0 && (
          <Select id="cajaCobro" label="Caja para cobrar" value={cajaId} onChange={(e) => setCajaId(e.target.value)}>
            {cajas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Select>
        )}
        {cajaId && !sesion && (
          <p className="mt-3 rounded-lg bg-warning-50 px-4 py-2.5 text-sm text-warning-700">
            Esta caja no tiene una sesión abierta. <Link to="/caja" className="font-medium underline">Abre una en Caja</Link> antes de convertir.
          </p>
        )}
      </Card>

      <Card>
        <div className="relative max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por folio..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </Card>

      <Card title="Cotizaciones recientes">
        <Table
          columnas={COLUMNAS_COTIZACIONES}
          ordenarPor={orden.ordenarPor}
          orden={orden.orden}
          onOrdenar={handleOrdenar}
          pie={(
            <Paginacion
              pagina={paginacion.pagina}
              totalPaginas={paginacion.totalPaginas}
              total={paginacion.total}
              onCambiar={cargarCotizaciones}
            />
          )}
        >
          {cotizaciones.length === 0 && <TablaVacia colSpan={4} />}
          {cotizaciones.map((c) => (
            <Fila key={c.id}>
              <Celda className="font-medium text-gray-800">{c.folio}</Celda>
              <Celda>{formatoMoneda(c.total)}</Celda>
              <Celda>
                <Badge tono={c.convertidaEnVentaId ? 'success' : 'warning'}>
                  {c.convertidaEnVentaId ? 'Convertida' : 'Pendiente'}
                </Badge>
              </Celda>
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
                  <button
                    type="button"
                    onClick={() => abrirEnvioCorreo(c.id)}
                    className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 hover:underline"
                    title="Enviar por correo"
                  >
                    <Mail size={14} /> Enviar
                  </button>
                  {!c.convertidaEnVentaId && (
                    <button type="button" onClick={() => abrirConversion(c.id)} className="text-sm text-primary-600 hover:underline">
                      Convertir en venta
                    </button>
                  )}
                </div>
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <Modal abierto={convirtiendoId !== null} onCerrar={cerrarConversion} titulo="Convertir cotización en venta">
        {convError && <p className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{convError}</p>}
        <form onSubmit={(e) => confirmarConversion(e, cotizacionEnConversion)} className="flex flex-col gap-4">
          <Select
            id="convMetodoPago"
            label="Método de pago"
            value={convMetodoPago}
            onChange={(e) => setConvMetodoPago(e.target.value)}
          >
            <option value="EFECTIVO">Efectivo</option>
            <option value="TARJETA">Tarjeta</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="MIXTO">Mixto</option>
          </Select>
          <p className="text-sm font-medium text-gray-700">
            Total a cobrar: {convTotal === null ? 'calculando…' : formatoMoneda(convTotal)}
          </p>
          {convRequiereAutorizacion && (
            <>
              <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
                Esta cotización incluye un descuento manual — requiere autorización de un
                Supervisor para convertirse en venta.
              </p>
              <Select
                id="convAutorizadoPorId"
                label="Autoriza"
                value={convAutorizadoPorId}
                onChange={(e) => setConvAutorizadoPorId(e.target.value)}
              >
                <option value="">Selecciona quién autoriza</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </Select>
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={cerrarConversion}>Cancelar</Button>
            <Button type="submit" disabled={convTotal === null}>Confirmar conversión</Button>
          </div>
        </form>
      </Modal>

      <EnviarCorreoModal
        abierto={envioCotizacionId !== null}
        onCerrar={cerrarEnvioCorreo}
        titulo="Enviar cotización por correo"
        destinatarioSugerido={envioCotizacion?.cliente?.correo || ''}
        asuntoSugerido={envioCotizacion ? `Cotización ${envioCotizacion.folio}` : ''}
        enviando={enviandoCorreo}
        error={errorEnvioCorreo}
        onEnviar={enviarCorreoCotizacion}
      />
    </div>
  );
}

export default CotizacionesPage;
