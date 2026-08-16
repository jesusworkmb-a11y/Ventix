import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Percent, Search } from 'lucide-react';
import { crearCompra } from '../api/compras.api';
import { listarProveedores } from '../../proveedores/api/proveedores.api';
import { listarSucursales } from '../../core/api/core.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Table, { Fila, Celda } from '../../../shared/ui/Table';
import { formatoMoneda } from '../../../shared/format';

const FOLIO_PROVEEDOR_MAX = 100;
const OBSERVACIONES_MAX = 500;

// Compras no consume el catálogo de Descuentos/Promociones (no lo tiene, a diferencia de
// Ventas) — solo un descuento manual por línea, %/monto fijo, sin permiso para cargarse (ver
// compras.service.js#calcularDescuentoManual, mismo cálculo del lado del backend).
function calcularDescuentoLinea(linea) {
  if (!linea.descuentoManual) return 0;
  const { tipo, valor } = linea.descuentoManual;
  const bruto = linea.cantidad * linea.costo;
  return tipo === 'PORCENTAJE' ? bruto * (Number(valor) / 100) : Math.min(Number(valor), bruto);
}

function ComprasPage() {
  const [proveedores, setProveedores] = useState([]);
  const [proveedorId, setProveedorId] = useState('');
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [folioProveedor, setFolioProveedor] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState('');
  const [creada, setCreada] = useState(null);

  // Mini-formulario inline de descuento manual por línea — mismo patrón que Ventas/Cotizaciones.
  const [manualEditIndex, setManualEditIndex] = useState(null);
  const [manualForm, setManualForm] = useState({ tipo: 'PORCENTAJE', valor: '' });

  useEffect(() => {
    listarProveedores().then(setProveedores).catch(() => {});
    listarSucursales()
      .then((data) => {
        setSucursales(data);
        if (data.length) setSucursalId((actual) => actual || data[0].id);
      })
      .catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
  }, []);

  // Agregar directo al carrito (clic en un resultado o Enter en el buscador) — sin selector ni
  // botón intermedio, mismo patrón que VentasPage/CotizacionesPage#agregarAlCarrito: si el
  // artículo ya está en el carrito, escanearlo/agregarlo de nuevo solo suma 1 a esa línea en vez
  // de duplicarla.
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
          unidadId: articulo.unidadBaseId,
          unidadBaseId: articulo.unidadBaseId,
          unidadBaseNombre: articulo.unidadBase?.nombre,
          unidadesAlternas: articulo.unidadesAlternas || [],
          cantidad: 1,
          // Último costo conocido del artículo como punto de partida — siempre editable, el
          // costo real de una compra se negocia cada vez con el proveedor.
          costo: Number(articulo.costo) || 0,
          impuestoTasa: articulo.impuesto ? Number(articulo.impuesto.tasa) : 0,
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
  // código/SKU o la búsqueda dejó un solo resultado, se agrega directo — mismo criterio que
  // VentasPage/CotizacionesPage#handleBusquedaKeyDown.
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

  function actualizarLinea(index, campo, valor) {
    setCarrito((c) => {
      const copia = [...c];
      copia[index] = { ...copia[index], [campo]: valor };
      return copia;
    });
  }

  // Si borrar una línea corre los índices, el mini-formulario de descuento manual (identificado
  // por índice) tiene que seguir a la línea correcta — mismo criterio que Ventas/Cotizaciones.
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
  const subtotal = carritoCalc.reduce((acc, l) => acc + (l.cantidad * l.costo - l.descuentoMonto), 0);
  const impuestosTotal = carritoCalc.reduce(
    (acc, l) => acc + (l.cantidad * l.costo - l.descuentoMonto) * (l.impuestoTasa || 0),
    0,
  );
  const total = Math.round((subtotal + impuestosTotal) * 100) / 100;

  async function agregar(e) {
    e.preventDefault();
    setError('');
    setCreada(null);
    if (carrito.length === 0) {
      setError('Agrega al menos un artículo.');
      return;
    }
    try {
      const compra = await crearCompra({
        proveedorId,
        sucursalId,
        ...(folioProveedor.trim() && { folioProveedor: folioProveedor.trim() }),
        ...(observaciones.trim() && { observaciones: observaciones.trim() }),
        detalles: carritoCalc.map((l) => ({
          articuloId: l.articuloId,
          unidadId: l.unidadId,
          cantidad: l.cantidad,
          costo: l.costo,
          ...(l.descuentoManual && { descuentoManual: { tipo: l.descuentoManual.tipo, valor: Number(l.descuentoManual.valor) } }),
        })),
      });
      setCreada(compra);
      setCarrito([]);
      setFolioProveedor('');
      setObservaciones('');
      setManualEditIndex(null);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la compra.');
    }
  }

  return (
    <form onSubmit={agregar} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Compras</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Nueva compra</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/compras/recientes"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <Button type="submit">Registrar compra</Button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
      {creada && (
        <p className="rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">
          Compra {creada.folio} registrada. Total: {formatoMoneda(creada.total)} — vela en{' '}
          <Link to="/compras/recientes" className="font-medium underline">Compras recientes</Link>.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Datos de la compra">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Select id="proveedorCompra" label="Proveedor" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} required>
                <option value="">Selecciona...</option>
                {proveedores.filter((p) => p.activo).map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </Select>
              <Select id="sucursalCompra" label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} required>
                <option value="">Selecciona...</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </Select>
              <Input
                id="folioProveedorCompra"
                label="Folio del proveedor"
                placeholder="Factura o remito (opcional)"
                maxLength={FOLIO_PROVEEDOR_MAX}
                value={folioProveedor}
                onChange={(e) => setFolioProveedor(e.target.value)}
              />
            </div>
          </Card>

          <Card
            title="Productos"
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
                  id="buscarArticuloCompra"
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
                      <span className="flex-shrink-0 text-gray-600">{formatoMoneda(a.costo)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {carrito.length > 0 && (
              <div className="mt-4">
                <Table columnas={['#', 'Código', 'Descripción', 'Cantidad', 'Unidad', 'Costo unitario', 'Descuento', 'Importe', '']}>
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
                          onChange={(e) => {
                            const num = Number(e.target.value);
                            if (num > 0) actualizarLinea(i, 'cantidad', num);
                          }}
                          className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-900"
                        />
                      </Celda>
                      <Celda>
                        {l.unidadesAlternas.length > 0 ? (
                          <select
                            value={l.unidadId}
                            onChange={(e) => actualizarLinea(i, 'unidadId', e.target.value)}
                            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                          >
                            <option value={l.unidadBaseId}>{l.unidadBaseNombre} (base)</option>
                            {l.unidadesAlternas.map((u) => (
                              <option key={u.unidadId} value={u.unidadId}>
                                {u.unidad?.nombre} (={Number(u.factor)} {l.unidadBaseNombre})
                              </option>
                            ))}
                          </select>
                        ) : (l.unidadBaseNombre || '—')}
                      </Celda>
                      <Celda>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={l.costo}
                          onChange={(e) => actualizarLinea(i, 'costo', Number(e.target.value))}
                          className="w-24 rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-900"
                        />
                      </Celda>
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
                        {formatoMoneda(l.cantidad * l.costo - l.descuentoMonto)}
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
              id="observacionesCompra"
              rows={3}
              maxLength={OBSERVACIONES_MAX}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas internas sobre esta compra..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="mt-1 text-right text-xs text-gray-400">{observaciones.length} / {OBSERVACIONES_MAX}</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <p className="text-sm text-gray-500">Total de la compra</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{formatoMoneda(total)}</p>
            <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm text-gray-500">
              {descuentoTotal > 0 && (
                <div className="flex items-center justify-between">
                  <span>Descuento</span>
                  <span className="font-medium text-success-700">-{formatoMoneda(descuentoTotal)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>{formatoMoneda(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Impuestos</span>
                <span>{formatoMoneda(impuestosTotal)}</span>
              </div>
            </div>
          </Card>

          <Card title="Tip">
            <p className="text-xs text-gray-500">
              Al confirmar se genera el folio de la compra y se actualiza el inventario de inmediato.
              Después podés descargarla en PDF, enviarla por correo o cancelarla desde
              &quot;Compras recientes&quot;.
            </p>
          </Card>
        </div>
      </div>
    </form>
  );
}

export default ComprasPage;
