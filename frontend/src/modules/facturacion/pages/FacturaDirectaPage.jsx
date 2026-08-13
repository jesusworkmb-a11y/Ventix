import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Search, Package, UserPlus } from 'lucide-react';
import { crearFacturaDirecta, obtenerSugerenciaFactura } from '../api/facturas.api';
import { listarSucursales } from '../../core/api/core.api';
import { listarClientes, crearCliente } from '../../clientes/api/clientes.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';
import ReceptorFiscalCampos, { RECEPTOR_VACIO, receptorDesdeCliente } from '../components/ReceptorFiscalCampos';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Modal from '../../../shared/ui/Modal';
import SelectorCatalogoSat from '../../../shared/ui/SelectorCatalogoSat';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { formatoMoneda, formatoFecha } from '../../../shared/format';

const OBJETO_IMPUESTO_OPCIONES = [
  { value: '02', label: '02 — Sí objeto de impuesto' },
  { value: '01', label: '01 — No objeto de impuesto' },
  { value: '03', label: '03 — Sí objeto, no obligado al desglose' },
  { value: '04', label: '04 — Sí objeto, no causa impuesto' },
];

const CONCEPTO_VACIO = {
  articuloId: null,
  claveProdServSat: null,
  claveUnidadSat: null,
  descripcion: '',
  cantidad: '1',
  valorUnitario: '',
  descuento: '0',
  objetoImpuesto: '02',
  impuestoClaveSat: '002',
  tipoFactorSat: 'Tasa',
  tasaOCuota: '0.16',
};

function importeConcepto(c) {
  const importe = Number(c.cantidad || 0) * Number(c.valorUnitario || 0) - Number(c.descuento || 0);
  if (c.objetoImpuesto !== '02' || c.tipoFactorSat === 'Exento') return { importe, impuesto: 0 };
  const impuesto = importe * Number(c.tasaOCuota || 0);
  return { importe, impuesto };
}

// Concepto "fresco" a partir de un Articulo del catálogo -- toma precio y claves SAT ACTUALES
// (no valores viejos), mismo criterio que el precio en vivo de Ventas.
function conceptoDesdeArticulo(articulo, cantidad = 1) {
  const tieneImpuesto = articulo.impuesto && Number(articulo.impuesto.tasa) > 0;
  return {
    articuloId: articulo.id,
    claveProdServSat: articulo.claveProdServSat,
    claveUnidadSat: articulo.unidadBase?.claveUnidadSat || null,
    descripcion: articulo.nombre,
    cantidad: String(cantidad),
    valorUnitario: String(articulo.precio),
    descuento: '0',
    objetoImpuesto: '02',
    impuestoClaveSat: '002',
    tipoFactorSat: tieneImpuesto ? 'Tasa' : 'Exento',
    tasaOCuota: tieneImpuesto ? String(articulo.impuesto.tasa) : '0',
  };
}

// Reconstruye un concepto congelado de una factura anterior cuando su articuloId ya no existe
// o quedó inactivo -- toma la tasa/clave de impuesto de FacturaDetalleImpuesto (tipo TRASLADO),
// así que no se pierde nada aunque el artículo ya no esté disponible para refrescar.
function conceptoCongeladoDesdeDetalle(d) {
  const traslado = d.impuestos?.find((i) => i.tipo === 'TRASLADO');
  return {
    articuloId: null,
    claveProdServSat: d.claveProdServSat,
    claveUnidadSat: d.claveUnidadSat,
    descripcion: d.descripcion,
    cantidad: String(d.cantidad),
    valorUnitario: String(d.valorUnitario),
    descuento: String(d.descuento || 0),
    objetoImpuesto: d.objetoImpuesto,
    impuestoClaveSat: traslado?.impuestoClaveSat || '002',
    tipoFactorSat: traslado?.tipoFactorSat || 'Exento',
    tasaOCuota: traslado?.tasaOCuota || '0',
    advertencia: 'Artículo ya no disponible en catálogo — se usó el precio/clave de la factura anterior.',
  };
}

function FacturaDirectaPage() {
  const navigate = useNavigate();
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState('');
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const busquedaRef = useRef(null);

  const [sugerencia, setSugerencia] = useState(null);
  const [sugerenciaIgnorada, setSugerenciaIgnorada] = useState(false);

  const [receptor, setReceptor] = useState(RECEPTOR_VACIO);
  const [formaPago, setFormaPago] = useState(null);
  const [metodoPago, setMetodoPago] = useState('PUE');
  const [conceptoForm, setConceptoForm] = useState(CONCEPTO_VACIO);
  const [conceptos, setConceptos] = useState([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [folioCreado, setFolioCreado] = useState('');

  const [nuevoClienteAbierto, setNuevoClienteAbierto] = useState(false);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState('');
  const [nuevoClienteTelefono, setNuevoClienteTelefono] = useState('');
  const [nuevoClienteError, setNuevoClienteError] = useState('');

  useEffect(() => {
    listarSucursales().then((s) => {
      setSucursales(s);
      if (s.length === 1) setSucursalId(s[0].id);
    }).catch(() => {});
    listarClientes().then(setClientes).catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
  }, []);

  // Sucursal + Cliente identificado -> busca si este cliente ya facturó antes desde esta
  // sucursal (Fase 1: sin tabla de plantillas, solo repetir la última factura). "Público en
  // general" (clienteId vacío) no dispara nada -- no hay a quién sugerirle nada.
  useEffect(() => {
    setSugerenciaIgnorada(false);
    if (!sucursalId || !clienteId) { setSugerencia(null); return; }
    let vigente = true;
    obtenerSugerenciaFactura({ sucursalId, clienteId })
      .then((f) => { if (vigente) setSugerencia(f); })
      .catch(() => { if (vigente) setSugerencia(null); });
    return () => { vigente = false; };
  }, [sucursalId, clienteId]);

  function seleccionarCliente(id) {
    setClienteId(id);
    const cliente = clientes.find((c) => c.id === id);
    setReceptor(cliente ? receptorDesdeCliente(cliente) : RECEPTOR_VACIO);
  }

  function actualizarReceptor(campo, valor) {
    setReceptor((r) => ({ ...r, [campo]: valor }));
  }

  // Clic en una tarjeta de producto (o Enter con match exacto) agrega directo, sumando 1 si el
  // artículo ya está en la lista -- mismo mecanismo que el carrito de Ventas.
  function agregarConceptoDesdeArticulo(articulo) {
    setError('');
    setConceptos((c) => {
      const idx = c.findIndex((linea) => linea.articuloId === articulo.id);
      if (idx !== -1) {
        const copia = [...c];
        copia[idx] = { ...copia[idx], cantidad: String(Number(copia[idx].cantidad) + 1) };
        return copia;
      }
      return [...c, conceptoDesdeArticulo(articulo)];
    });
  }

  const articulosFiltrados = articulos.filter((a) => {
    if (a.articuloPadreId || (a._count?.variantes || 0) > 0) return false; // variantes: fuera de alcance de esta fase
    if (!a.activo) return false;
    if (!busquedaProducto.trim()) return true;
    const texto = busquedaProducto.trim().toLowerCase();
    return (
      a.nombre.toLowerCase().includes(texto) ||
      (a.sku || '').toLowerCase().includes(texto) ||
      (a.codigoBarras || '').toLowerCase().includes(texto)
    );
  });

  function handleBusquedaProductoKeyDown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const texto = busquedaProducto.trim().toLowerCase();
    if (!texto) return;
    const exacto = articulosFiltrados.find(
      (a) => (a.codigoBarras || '').toLowerCase() === texto || (a.sku || '').toLowerCase() === texto,
    );
    if (exacto && exacto.claveProdServSat && exacto.unidadBase?.claveUnidadSat) {
      agregarConceptoDesdeArticulo(exacto);
      setBusquedaProducto('');
      return;
    }
    if (articulosFiltrados.length === 1 && articulosFiltrados[0].claveProdServSat && articulosFiltrados[0].unidadBase?.claveUnidadSat) {
      agregarConceptoDesdeArticulo(articulosFiltrados[0]);
      setBusquedaProducto('');
    }
  }

  // "Usar como base": clona los conceptos de la sugerencia. Si el articuloId sigue existiendo y
  // activo, resuelve precio/clave SAT ACTUALES (no los congelados); si no, cae al concepto
  // congelado de la factura anterior, marcado con una advertencia informativa (no bloqueante).
  function usarSugerenciaComoBase() {
    if (!sugerencia) return;
    const nuevosConceptos = sugerencia.detalles.map((d) => {
      const articuloActual = d.articuloId ? articulos.find((a) => a.id === d.articuloId && a.activo) : null;
      return articuloActual
        ? conceptoDesdeArticulo(articuloActual, Number(d.cantidad))
        : conceptoCongeladoDesdeDetalle(d);
    });
    setConceptos(nuevosConceptos);
    setFormaPago(sugerencia.formaPago);
    setMetodoPago(sugerencia.metodoPago);
    setSugerenciaIgnorada(true);
  }

  function agregarConcepto(e) {
    e.preventDefault();
    if (!conceptoForm.claveProdServSat || !conceptoForm.claveUnidadSat) {
      setError('Elegí la clave de producto/servicio y la clave de unidad SAT.');
      return;
    }
    if (!conceptoForm.descripcion || !conceptoForm.valorUnitario) {
      setError('Completá descripción y valor unitario.');
      return;
    }
    setError('');
    setConceptos((c) => [...c, conceptoForm]);
    setConceptoForm(CONCEPTO_VACIO);
  }

  function quitarConcepto(index) {
    setConceptos((c) => c.filter((_, i) => i !== index));
  }

  const totales = conceptos.reduce((acc, c) => {
    const { importe, impuesto } = importeConcepto(c);
    return { subtotal: acc.subtotal + importe, impuestos: acc.impuestos + impuesto };
  }, { subtotal: 0, impuestos: 0 });
  const total = totales.subtotal + totales.impuestos;

  function limpiarFactura() {
    setConceptos([]);
    setConceptoForm(CONCEPTO_VACIO);
    setClienteId('');
    setReceptor(RECEPTOR_VACIO);
    setFormaPago(null);
    setError('');
  }

  async function crearFactura() {
    setError('');
    if (!sucursalId) { setError('Elegí la sucursal de expedición.'); return; }
    if (conceptos.length === 0) { setError('Agregá al menos un concepto.'); return; }
    if (!formaPago) { setError('Elegí la forma de pago.'); return; }
    if (guardando) return;

    setGuardando(true);
    try {
      const factura = await crearFacturaDirecta({
        sucursalId,
        receptor: clienteId ? { ...receptor, clienteId } : receptor,
        formaPago,
        metodoPago,
        conceptos: conceptos.map((c) => ({
          articuloId: c.articuloId || undefined,
          claveProdServSat: c.claveProdServSat,
          claveUnidadSat: c.claveUnidadSat,
          descripcion: c.descripcion,
          cantidad: Number(c.cantidad),
          valorUnitario: Number(c.valorUnitario),
          descuento: Number(c.descuento || 0),
          objetoImpuesto: c.objetoImpuesto,
          impuesto: c.objetoImpuesto === '02' ? {
            impuestoClaveSat: c.impuestoClaveSat,
            tipoFactorSat: c.tipoFactorSat,
            tasaOCuota: c.tipoFactorSat === 'Exento' ? undefined : Number(c.tasaOCuota),
          } : undefined,
        })),
      });
      setFolioCreado(factura.folio);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la factura.');
    } finally {
      setGuardando(false);
    }
  }

  function confirmar(e) {
    e.preventDefault();
    crearFactura();
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
      seleccionarCliente(cliente.id);
      setNuevoClienteAbierto(false);
    } catch (err) {
      setNuevoClienteError(err.response?.data?.error || 'No se pudo crear el cliente.');
    }
  }

  const hayModalAbierto = nuevoClienteAbierto;
  const haySugerenciaVisible = sugerencia && !sugerenciaIgnorada;

  useEffect(() => {
    function onKeyDown(e) {
      if (folioCreado || hayModalAbierto) return;
      if (e.key === 'F1') {
        e.preventDefault();
        crearFactura();
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        busquedaRef.current?.focus();
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        abrirNuevoCliente();
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        if (haySugerenciaVisible) usarSugerenciaComoBase();
        return;
      }
      if (e.key === 'Escape') {
        if (busquedaProducto) {
          setBusquedaProducto('');
        } else if (conceptos.length > 0 || clienteId) {
          limpiarFactura();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folioCreado, hayModalAbierto, busquedaProducto, conceptos, clienteId, haySugerenciaVisible, sugerencia, guardando, sucursalId, formaPago]);

  if (folioCreado) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="space-y-3 text-center">
            <h1 className="text-xl font-bold text-gray-900">Factura {folioCreado} creada</h1>
            <p className="text-sm text-gray-500">Queda en estado Pendiente hasta que se integre el timbrado ante el SAT.</p>
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="secondary" onClick={() => { setFolioCreado(''); limpiarFactura(); }}>
                Crear otra
              </Button>
              <Button onClick={() => navigate('/facturacion')}>Ver facturas</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Factura directa</h1>
        <p className="text-sm text-gray-500">Emisión libre de CFDI, sin depender de una venta previa del POS.</p>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}

      <Card title="Sucursal y receptor">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              id="sucursalDirecta"
              label="Sucursal de expedición"
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
              required
            >
              <option value="">Selecciona...</option>
              {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Select>
            <div className="flex items-end gap-2">
              <Select
                id="clienteDirecta"
                label="Cliente"
                value={clienteId}
                onChange={(e) => seleccionarCliente(e.target.value)}
                className="flex-1"
              >
                <option value="">Público en general (RFC genérico)</option>
                {clientes.filter((c) => c.activo && !c.esGeneral).map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </Select>
              <Button type="button" variant="secondary" onClick={abrirNuevoCliente} title="Nuevo cliente (F3)">
                <UserPlus size={16} />
              </Button>
            </div>
          </div>

          {haySugerenciaVisible && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
              <p className="text-sm text-primary-900">
                Este cliente ya facturó desde esta sucursal — última vez <strong>{formatoFecha(sugerencia.creadoEn)}</strong>,
                {' '}{sugerencia.detalles.length} concepto(s), {formatoMoneda(sugerencia.total)}. ¿Usar como base?
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={usarSugerenciaComoBase}>Usar como base (F4)</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setSugerenciaIgnorada(true)}>Ignorar</Button>
              </div>
            </div>
          )}

          <ReceptorFiscalCampos value={receptor} onChange={actualizarReceptor} idPrefix="directa" />
        </div>
      </Card>

      <Card title="Conceptos">
        <div className="mb-5">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={busquedaRef}
              type="text"
              placeholder="Escanear código o buscar producto del catálogo... (F2)"
              value={busquedaProducto}
              onChange={(e) => setBusquedaProducto(e.target.value)}
              onKeyDown={handleBusquedaProductoKeyDown}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {articulosFiltrados.map((a) => {
              const facturable = Boolean(a.claveProdServSat && a.unidadBase?.claveUnidadSat);
              return (
                <button
                  type="button"
                  key={a.id}
                  disabled={!facturable}
                  onClick={() => agregarConceptoDesdeArticulo(a)}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition-colors ${
                    facturable
                      ? 'border-gray-200 bg-white hover:border-primary-400 hover:bg-primary-50'
                      : 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="mb-2 flex h-12 w-full items-center justify-center rounded-lg bg-gray-100">
                    {a.imagenUrl ? (
                      <img src={a.imagenUrl} alt="" className="h-full w-full rounded-lg object-cover" />
                    ) : (
                      <Package size={18} className="text-gray-400" />
                    )}
                  </div>
                  <span className="line-clamp-2 text-sm font-medium text-gray-800">{a.nombre}</span>
                  {facturable ? (
                    <span className="mt-1 text-sm font-semibold text-primary-700">{formatoMoneda(a.precio)}</span>
                  ) : (
                    <span className="mt-1 text-xs font-medium text-warning-700">Sin clave SAT</span>
                  )}
                </button>
              );
            })}
            {articulosFiltrados.length === 0 && (
              <p className="col-span-full py-6 text-center text-sm text-gray-400">No se encontraron productos.</p>
            )}
          </div>
        </div>

        <details className="rounded-lg border border-gray-200">
          <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900">
            Cargar un concepto manual (sin ligar a un artículo del catálogo)
          </summary>
          <form onSubmit={agregarConcepto} className="grid grid-cols-1 gap-4 border-t border-gray-100 p-4 sm:grid-cols-3">
            <SelectorCatalogoSat
              id="conceptoClaveProdServ"
              tipo="ClaveProdServ"
              label="Clave prod/serv SAT"
              value={conceptoForm.claveProdServSat}
              onChange={(v) => setConceptoForm((f) => ({ ...f, claveProdServSat: v }))}
            />
            <SelectorCatalogoSat
              id="conceptoClaveUnidad"
              tipo="ClaveUnidad"
              label="Clave unidad SAT"
              value={conceptoForm.claveUnidadSat}
              onChange={(v) => setConceptoForm((f) => ({ ...f, claveUnidadSat: v }))}
            />
            <Input
              id="conceptoDescripcion"
              label="Descripción"
              value={conceptoForm.descripcion}
              onChange={(e) => setConceptoForm((f) => ({ ...f, descripcion: e.target.value }))}
            />
            <Input
              id="conceptoCantidad"
              label="Cantidad"
              type="number"
              step="0.01"
              min="0.01"
              value={conceptoForm.cantidad}
              onChange={(e) => setConceptoForm((f) => ({ ...f, cantidad: e.target.value }))}
            />
            <Input
              id="conceptoValorUnitario"
              label="Valor unitario"
              type="number"
              step="0.01"
              min="0"
              value={conceptoForm.valorUnitario}
              onChange={(e) => setConceptoForm((f) => ({ ...f, valorUnitario: e.target.value }))}
            />
            <Input
              id="conceptoDescuento"
              label="Descuento (opcional)"
              type="number"
              step="0.01"
              min="0"
              value={conceptoForm.descuento}
              onChange={(e) => setConceptoForm((f) => ({ ...f, descuento: e.target.value }))}
            />
            <Select
              id="conceptoObjetoImpuesto"
              label="Objeto de impuesto"
              value={conceptoForm.objetoImpuesto}
              onChange={(e) => setConceptoForm((f) => ({ ...f, objetoImpuesto: e.target.value }))}
            >
              {OBJETO_IMPUESTO_OPCIONES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            {conceptoForm.objetoImpuesto === '02' && (
              <>
                <Select
                  id="conceptoImpuestoClave"
                  label="Impuesto"
                  value={conceptoForm.impuestoClaveSat}
                  onChange={(e) => setConceptoForm((f) => ({ ...f, impuestoClaveSat: e.target.value }))}
                >
                  <option value="002">IVA (002)</option>
                  <option value="003">IEPS (003)</option>
                  <option value="001">ISR (001)</option>
                </Select>
                <Select
                  id="conceptoTipoFactor"
                  label="Tipo de factor"
                  value={conceptoForm.tipoFactorSat}
                  onChange={(e) => setConceptoForm((f) => ({ ...f, tipoFactorSat: e.target.value }))}
                >
                  <option value="Tasa">Tasa</option>
                  <option value="Cuota">Cuota</option>
                  <option value="Exento">Exento</option>
                </Select>
                {conceptoForm.tipoFactorSat !== 'Exento' && (
                  <Input
                    id="conceptoTasaOCuota"
                    label="Tasa (ej. 0.16) / cuota"
                    type="number"
                    step="0.0001"
                    min="0"
                    value={conceptoForm.tasaOCuota}
                    onChange={(e) => setConceptoForm((f) => ({ ...f, tasaOCuota: e.target.value }))}
                  />
                )}
              </>
            )}
            <div className="sm:col-span-3">
              <Button type="submit" variant="secondary">Agregar concepto</Button>
            </div>
          </form>
        </details>

        <div className="mt-5">
          <Table columnas={['Descripción', 'Cant.', 'V. unitario', 'Importe', '']}>
            {conceptos.length === 0 && <TablaVacia colSpan={5} />}
            {conceptos.map((c, i) => {
              const { importe } = importeConcepto(c);
              return (
                <Fila key={i}>
                  <Celda>
                    {c.descripcion}
                    {c.advertencia && <span className="mt-0.5 block text-xs text-warning-700">{c.advertencia}</span>}
                  </Celda>
                  <Celda>{c.cantidad}</Celda>
                  <Celda>{formatoMoneda(c.valorUnitario)}</Celda>
                  <Celda>{formatoMoneda(importe)}</Celda>
                  <Celda className="text-right">
                    <button type="button" onClick={() => quitarConcepto(i)} className="text-gray-400 hover:text-danger-600">
                      <Trash2 size={16} />
                    </button>
                  </Celda>
                </Fila>
              );
            })}
          </Table>
        </div>
      </Card>

      <Card title="Pago y confirmación">
        <form onSubmit={confirmar} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectorCatalogoSat
              id="formaPagoDirecta"
              tipo="FormaPago"
              label="Forma de pago"
              value={formaPago}
              onChange={setFormaPago}
              required
            />
            <Select
              id="metodoPagoDirecta"
              label="Método de pago"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
            >
              <option value="PUE">PUE — Pago en una sola exhibición</option>
              <option value="PPD">PPD — Pago en parcialidades o diferido</option>
            </Select>
          </div>

          <div className="flex justify-end gap-6 border-t border-gray-100 pt-4 text-sm">
            <span>Subtotal: <strong>{formatoMoneda(totales.subtotal)}</strong></span>
            <span>Impuestos: <strong>{formatoMoneda(totales.impuestos)}</strong></span>
            <span>Total: <strong>{formatoMoneda(total)}</strong></span>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={guardando}>{guardando ? 'Creando…' : 'Crear factura (F1)'}</Button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs text-gray-400">
            <span><kbd className="rounded border border-gray-200 px-1.5 py-0.5 font-sans">F1</kbd> Crear factura</span>
            <span><kbd className="rounded border border-gray-200 px-1.5 py-0.5 font-sans">F2</kbd> Buscar producto</span>
            <span><kbd className="rounded border border-gray-200 px-1.5 py-0.5 font-sans">F3</kbd> Nuevo cliente</span>
            {haySugerenciaVisible && <span><kbd className="rounded border border-gray-200 px-1.5 py-0.5 font-sans">F4</kbd> Aplicar sugerencia</span>}
            <span><kbd className="rounded border border-gray-200 px-1.5 py-0.5 font-sans">Esc</kbd> Limpiar</span>
          </div>
        </form>
      </Card>

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
    </div>
  );
}

export default FacturaDirectaPage;
