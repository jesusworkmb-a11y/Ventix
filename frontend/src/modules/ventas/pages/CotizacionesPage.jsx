import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, FileDown, Percent } from 'lucide-react';
import { crearCotizacion, obtenerCotizacion } from '../api/cotizaciones.api';
import { listarCajas } from '../../caja/api/caja.api';
import { listarClientes } from '../../clientes/api/clientes.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';
import { useAuth } from '../../../shared/context/AuthContext';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Table, { Fila, Celda } from '../../../shared/ui/Table';
import { formatoMoneda } from '../../../shared/format';

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
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la cotización.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-sm text-gray-500">Creá cotizaciones para tus clientes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/ventas"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Volver a Ventas
          </Link>
          <Link
            to="/ventas/cotizaciones/recientes"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Ver cotizaciones recientes
          </Link>
        </div>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </div>

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
    </div>
  );
}

export default CotizacionesPage;
