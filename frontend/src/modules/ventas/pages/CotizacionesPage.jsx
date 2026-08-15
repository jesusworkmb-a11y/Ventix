import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Percent, Search } from 'lucide-react';
import { crearCotizacion } from '../api/cotizaciones.api';
import { listarCajas } from '../../caja/api/caja.api';
import { listarClientes } from '../../clientes/api/clientes.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';
import Table, { Fila, Celda } from '../../../shared/ui/Table';
import { formatoMoneda } from '../../../shared/format';

const VIGENCIA_DEFAULT_DIAS = 15;
const OBSERVACIONES_MAX = 500;

// Cotizaciones no consume el catálogo de Descuentos/Promociones (a diferencia de Ventas) —
// solo un descuento manual por línea, %/monto fijo, sin permiso para cargarse (ver
// cotizaciones.service.js#calcularDescuentoManual, mismo cálculo del lado del backend).
function calcularDescuentoLinea(linea) {
  if (!linea.descuentoManual) return 0;
  const { tipo, valor } = linea.descuentoManual;
  const bruto = linea.cantidad * linea.precio;
  return tipo === 'PORCENTAJE' ? bruto * (Number(valor) / 100) : Math.min(Number(valor), bruto);
}

function hoyMasDias(dias) {
  const f = new Date();
  f.setDate(f.getDate() + dias);
  return f.toISOString().slice(0, 10);
}

// `vigencia` se trata como fecha de calendario pura (sin hora) — se compara/formatea por
// substring en vez de con un Date completo para no arrastrar el offset de zona horaria del
// navegador (Date.UTC de ambos lados evita el mismo problema al calcular la diferencia en días).
function formatoFechaCorta(fechaIso) {
  if (!fechaIso) return '';
  const [anio, mes, dia] = fechaIso.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

function diasRestantes(fechaIso) {
  if (!fechaIso) return null;
  const hoy = new Date();
  const hoyUtc = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const [anio, mes, dia] = fechaIso.slice(0, 10).split('-').map(Number);
  const fechaUtc = Date.UTC(anio, mes - 1, dia);
  return Math.round((fechaUtc - hoyUtc) / 86400000);
}

function CotizacionesPage() {
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [vigencia, setVigencia] = useState(() => hoyMasDias(VIGENCIA_DEFAULT_DIAS));
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState('');
  const [creada, setCreada] = useState(null);

  // Mini-formulario inline de descuento manual por línea — mismo patrón que VentasPage.
  const [manualEditIndex, setManualEditIndex] = useState(null);
  const [manualForm, setManualForm] = useState({ tipo: 'PORCENTAJE', valor: '' });

  const [cajas, setCajas] = useState([]);
  const [cajaId, setCajaId] = useState('');

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
  }, []);

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

  // Agregar directo al carrito (clic en un resultado o Enter en el buscador) — sin selector ni
  // botón intermedio, mismo patrón que VentasPage#agregarAlCarrito: si el artículo ya está en el
  // carrito, escanearlo/agregarlo de nuevo solo suma 1 a esa línea en vez de duplicarla.
  function agregarArticulo(articulo) {
    setCarrito((c) => {
      const idx = c.findIndex((l) => l.articuloId === articulo.id);
      if (idx !== -1) {
        const copia = [...c];
        copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + 1 };
        return copia;
      }
      return [
        ...c,
        {
          articuloId: articulo.id,
          nombre: articulo.nombre,
          descripcion: articulo.descripcion,
          sku: articulo.sku,
          unidad: articulo.unidadBase?.nombre,
          cantidad: 1,
          precio: precioEfectivo(articulo),
          descuentoManual: null,
        },
      ];
    });
    setBusqueda('');
  }

  const articulosFiltrados = busqueda.trim()
    ? articulos.filter((a) => {
      if (!a.activo) return false;
      const texto = busqueda.trim().toLowerCase();
      return (
        a.nombre.toLowerCase().includes(texto)
        || (a.sku || '').toLowerCase().includes(texto)
        || (a.codigoBarras || '').toLowerCase().includes(texto)
      );
    }).slice(0, 8)
    : [];

  // Escaneo por código de barras: al presionar Enter, si hay una coincidencia exacta de
  // código/SKU o la búsqueda dejó un solo resultado, se agrega directo sin más clics — mismo
  // criterio que VentasPage#handleBusquedaKeyDown.
  function handleBusquedaKeyDown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return;
    const exacto = articulos.find(
      (a) => a.activo && ((a.codigoBarras || '').toLowerCase() === texto || (a.sku || '').toLowerCase() === texto),
    );
    if (exacto) { agregarArticulo(exacto); return; }
    if (articulosFiltrados.length === 1) agregarArticulo(articulosFiltrados[0]);
  }

  function actualizarCantidad(index, valor) {
    const num = Number(valor);
    if (!num || num <= 0) return;
    setCarrito((c) => {
      const copia = [...c];
      copia[index] = { ...copia[index], cantidad: num };
      return copia;
    });
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
  const dias = diasRestantes(vigencia);

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
        ...(vigencia && { vigencia: new Date(vigencia).toISOString() }),
        ...(observaciones.trim() && { observaciones: observaciones.trim() }),
        detalles: carritoCalc.map((l) => ({
          articuloId: l.articuloId,
          cantidad: l.cantidad,
          ...(l.descuentoManual && { descuentoManual: { tipo: l.descuentoManual.tipo, valor: Number(l.descuentoManual.valor) } }),
        })),
      });
      setCreada(cotizacion);
      setCarrito([]);
      setObservaciones('');
      setVigencia(hoyMasDias(VIGENCIA_DEFAULT_DIAS));
      setManualEditIndex(null);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la cotización.');
    }
  }

  return (
    <form onSubmit={confirmarCotizacion} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Cotizaciones</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Nueva cotización</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/ventas/cotizaciones/recientes"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <Button type="submit">Crear cotización</Button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
      {creada && (
        <p className="rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">
          Cotización {creada.folio} creada. Total: {formatoMoneda(creada.total)} — descargala o convertila en
          venta desde{' '}
          <Link to="/ventas/cotizaciones/recientes" className="font-medium underline">Cotizaciones recientes</Link>.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Datos generales">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Select id="clienteCot" label="Cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                {clientes.filter((c) => c.activo).map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}{c.esGeneral ? ' (general)' : ''}</option>
                ))}
              </Select>
              {cajas.length > 0 && (
                <Select id="cajaCot" label="Sucursal (vía caja)" value={cajaId} onChange={(e) => setCajaId(e.target.value)}>
                  {cajas.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </Select>
              )}
              <Input
                id="vigenciaCot"
                label="Vigencia"
                type="date"
                value={vigencia}
                onChange={(e) => setVigencia(e.target.value)}
              />
            </div>
          </Card>

          <Card
            title="Conceptos"
            action={carrito.length > 0 && (
              <span className="text-xs font-medium text-gray-400">
                {carrito.length} línea{carrito.length === 1 ? '' : 's'}
              </span>
            )}
          >
            <div className="relative">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="buscarArticuloCot"
                  type="text"
                  autoComplete="off"
                  placeholder="Escaneá un código de barras o escribí para buscar..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={handleBusquedaKeyDown}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              {articulosFiltrados.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {articulosFiltrados.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => agregarArticulo(a)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <span className="min-w-0">
                        <span className="font-medium text-gray-800">{a.nombre}</span>
                        {a.sku && <span className="ml-2 text-xs text-gray-400">{a.sku}</span>}
                      </span>
                      <span className="flex-shrink-0 text-gray-600">{formatoMoneda(precioEfectivo(a))}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {carrito.length > 0 && (
              <div className="mt-4">
                <Table columnas={['#', 'Código', 'Descripción', 'Cantidad', 'Unidad', 'Precio unitario', 'Descuento', 'Importe', '']}>
                  {carritoCalc.map((l, i) => (
                    <Fila key={i}>
                      <Celda className="text-gray-400">{i + 1}</Celda>
                      <Celda className="font-mono text-xs text-gray-500">{l.sku || '—'}</Celda>
                      <Celda>
                        <p className="font-medium text-gray-800">{l.nombre}</p>
                        {l.descripcion && <p className="text-xs text-gray-400">{l.descripcion}</p>}
                      </Celda>
                      <Celda>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={l.cantidad}
                          onChange={(e) => actualizarCantidad(i, e.target.value)}
                          className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-900"
                        />
                      </Celda>
                      <Celda>{l.unidad || '—'}</Celda>
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
                      <Celda className="font-medium text-gray-800">
                        {formatoMoneda(l.cantidad * l.precio - l.descuentoMonto)}
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
          </Card>

          <Card title="Observaciones">
            <textarea
              id="observacionesCot"
              rows={3}
              maxLength={OBSERVACIONES_MAX}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Condiciones, notas para el cliente..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="mt-1 text-right text-xs text-gray-400">{observaciones.length} / {OBSERVACIONES_MAX}</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <p className="text-sm text-gray-500">Total de la cotización</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{formatoMoneda(total)}</p>
            <p className="mt-1 text-xs text-gray-400">Subtotal — el IVA se calcula al convertir en venta.</p>
            {descuentoTotal > 0 && (
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-sm text-gray-500">
                <span>Descuento</span>
                <span className="font-medium text-success-700">-{formatoMoneda(descuentoTotal)}</span>
              </div>
            )}
          </Card>

          {vigencia && (
            <Card title="Vigencia">
              <p className="text-sm text-gray-700">Vence el {formatoFechaCorta(vigencia)}</p>
              <div className="mt-2">
                {dias !== null && (
                  dias < 0
                    ? <Badge tono="danger">Vencida</Badge>
                    : <Badge tono={dias <= 3 ? 'warning' : 'primary'}>{dias} día{dias === 1 ? '' : 's'}</Badge>
                )}
              </div>
            </Card>
          )}

          <Card title="Tip">
            <p className="text-xs text-gray-500">
              Al confirmar se genera el folio de la cotización. Después podés descargarla en PDF, enviarla
              por correo o convertirla en venta desde "Cotizaciones recientes".
            </p>
          </Card>
        </div>
      </div>
    </form>
  );
}

export default CotizacionesPage;
