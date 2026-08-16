import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Search } from 'lucide-react';
import { crearOrdenCompra } from '../api/ordenes.api';
import { listarProveedores } from '../../proveedores/api/proveedores.api';
import { listarSucursales } from '../../core/api/core.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Select from '../../../shared/ui/Select';
import Table, { Fila, Celda } from '../../../shared/ui/Table';

const OBSERVACIONES_MAX = 500;

function OrdenCompraPage() {
  const [proveedores, setProveedores] = useState([]);
  const [proveedorId, setProveedorId] = useState('');
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState('');
  const [creada, setCreada] = useState(null);

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

  // Mismo patrón de buscador/escaneo que ComprasPage/VentasPage/CotizacionesPage — sin precio
  // ni impuesto acá, una orden no es un documento fiscal, solo lo que se le va a pedir al
  // proveedor.
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
          costoEstimado: '',
        },
      ];
    });
    setBusqueda('');
  }

  const articulosFiltrados = busqueda.trim()
    ? articulos.filter((a) => {
      // Igual que en la recepción (ComprasPage): un Kit no se solicita a un proveedor como
      // unidad, se pide sus componentes por separado.
      if (!a.activo || a.tipo === 'KIT') return false;
      const texto = busqueda.trim().toLowerCase();
      return (
        a.nombre.toLowerCase().includes(texto)
        || (a.sku || '').toLowerCase().includes(texto)
        || (a.codigoBarras || '').toLowerCase().includes(texto)
      );
    }).slice(0, 8)
    : [];

  function handleBusquedaKeyDown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return;
    const exacto = articulos.find(
      (a) => a.activo && a.tipo !== 'KIT'
        && ((a.codigoBarras || '').toLowerCase() === texto || (a.sku || '').toLowerCase() === texto),
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

  function quitarLinea(index) {
    setCarrito((c) => c.filter((_, i) => i !== index));
  }

  async function agregar(e) {
    e.preventDefault();
    setError('');
    setCreada(null);
    if (carrito.length === 0) {
      setError('Agrega al menos un artículo.');
      return;
    }
    try {
      const orden = await crearOrdenCompra({
        proveedorId,
        sucursalId,
        ...(observaciones.trim() && { observaciones: observaciones.trim() }),
        detalles: carrito.map((l) => ({
          articuloId: l.articuloId,
          unidadId: l.unidadId,
          cantidad: l.cantidad,
          ...(l.costoEstimado !== '' && { costoEstimado: Number(l.costoEstimado) }),
        })),
      });
      setCreada(orden);
      setCarrito([]);
      setObservaciones('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la orden de compra.');
    }
  }

  return (
    <form onSubmit={agregar} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Órdenes de compra</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Nueva orden de compra</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/compras/ordenes/recientes"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <Button type="submit">Crear orden</Button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
      {creada && (
        <p className="rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">
          Orden {creada.folio} creada — envíasela al proveedor o recibí la mercancía cuando llegue
          desde{' '}
          <Link to="/compras/ordenes/recientes" className="font-medium underline">Órdenes recientes</Link>.
        </p>
      )}

      <Card title="Datos de la orden">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select id="proveedorOrden" label="Proveedor" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} required>
            <option value="">Selecciona...</option>
            {proveedores.filter((p) => p.activo).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
          <Select id="sucursalOrden" label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} required>
            <option value="">Selecciona...</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
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
              id="buscarArticuloOrden"
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
                </button>
              ))}
            </div>
          )}
        </div>

        {carrito.length > 0 && (
          <div className="mt-4">
            <Table columnas={['#', 'Código', 'Descripción', 'Cantidad', 'Unidad', 'Costo estimado', '']}>
              {carrito.map((l, i) => (
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
                      placeholder="Opcional"
                      value={l.costoEstimado}
                      onChange={(e) => actualizarLinea(i, 'costoEstimado', e.target.value)}
                      className="w-24 rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400"
                    />
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
          id="observacionesOrden"
          rows={3}
          maxLength={OBSERVACIONES_MAX}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Condiciones, notas para el proveedor..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <p className="mt-1 text-right text-xs text-gray-400">{observaciones.length} / {OBSERVACIONES_MAX}</p>
      </Card>

      <Card title="Tip">
        <p className="text-xs text-gray-500">
          Una orden de compra no mueve inventario ni dinero — es solo la solicitud al proveedor.
          El costo estimado es opcional, únicamente para negociar; el costo real se captura al
          recibir la mercancía. Podés recibirla en varias entregas parciales hasta completarla.
        </p>
      </Card>
    </form>
  );
}

export default OrdenCompraPage;
