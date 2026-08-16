import { useEffect, useState } from 'react';
import {
  listarConteos,
  obtenerConteo,
  crearConteo,
  reemplazarDetallesConteo,
  cambiarEstadoConteo,
} from '../api/conteos.api';
import { listarSucursales } from '../../core/api/core.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';
import Modal from '../../../shared/ui/Modal';
import Paginacion from '../../../shared/ui/Paginacion';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { Trash2 } from 'lucide-react';

const SIGUIENTE_ESTADO = { CAPTURA: 'REVISION', REVISION: 'AUTORIZADO' };
const ESTADO_TONO = { CAPTURA: 'gray', REVISION: 'warning', AUTORIZADO: 'success' };

const COLUMNAS_CONTEOS = [
  { label: 'Sucursal', clave: null },
  { label: 'Estado', clave: 'estado', ordenable: true },
  { label: 'Fecha', clave: 'creadoEn', ordenable: true },
  { label: '', clave: null },
];

function ConteosPage() {
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [error, setError] = useState('');
  const [conteos, setConteos] = useState([]);
  const [filtroSucursalId, setFiltroSucursalId] = useState('');
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [orden, setOrden] = useState({ ordenarPor: 'creadoEn', orden: 'desc' });

  const [abiertoId, setAbiertoId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [capArticuloId, setCapArticuloId] = useState('');
  const [capCantidad, setCapCantidad] = useState('');
  const [capCarrito, setCapCarrito] = useState([]);
  const [panelError, setPanelError] = useState('');

  useEffect(() => {
    listarSucursales()
      .then((data) => {
        setSucursales(data);
        if (data.length) setSucursalId((actual) => actual || data[0].id);
      })
      .catch(() => {});
    // Un artículo tipo Servicio no lleva inventario (backend lo rechaza) — se excluye acá.
    listarArticulos().then((data) => setArticulos(data.filter((a) => a.tipo !== 'SERVICIO'))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cargarConteos(pagina = 1) {
    listarConteos({
      sucursalId: filtroSucursalId || undefined,
      pagina,
      porPagina: 20,
      ordenarPor: orden.ordenarPor,
      orden: orden.orden,
    })
      .then((r) => {
        setConteos(r.datos);
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
    cargarConteos(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroSucursalId, orden]);

  function nombreSucursal(id) {
    return sucursales.find((s) => s.id === id)?.nombre || id;
  }

  async function handleCrear(e) {
    e.preventDefault();
    setError('');
    try {
      const conteo = await crearConteo({ sucursalId });
      cargarConteos(1);
      abrirConteo(conteo.id);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el conteo.');
    }
  }

  async function abrirConteo(id) {
    setPanelError('');
    setAbiertoId(id);
    setDetalle(null);
    setCapCarrito([]);
    try {
      const d = await obtenerConteo(id);
      setDetalle(d);
      if (d.estado === 'CAPTURA') {
        setCapCarrito(d.detalles.map((det) => ({
          articuloId: det.articuloId,
          nombre: det.articulo?.nombre || det.articuloId,
          cantidadFisica: Number(det.cantidadFisica),
        })));
      }
    } catch (err) {
      setPanelError('No se pudo cargar el conteo.');
    }
  }

  function cerrarConteo() {
    setAbiertoId(null);
    setDetalle(null);
    setCapCarrito([]);
  }

  function agregarLineaCaptura(e) {
    e.preventDefault();
    const articulo = articulos.find((a) => a.id === capArticuloId);
    if (!articulo) return;
    setCapCarrito((c) => [
      ...c.filter((l) => l.articuloId !== capArticuloId),
      { articuloId: capArticuloId, nombre: articulo.nombre, cantidadFisica: Number(capCantidad) },
    ]);
    setCapArticuloId('');
    setCapCantidad('');
  }

  function quitarLineaCaptura(articuloId) {
    setCapCarrito((c) => c.filter((l) => l.articuloId !== articuloId));
  }

  async function guardarLineas() {
    setPanelError('');
    try {
      await reemplazarDetallesConteo(abiertoId, {
        detalles: capCarrito.map((l) => ({ articuloId: l.articuloId, cantidadFisica: l.cantidadFisica })),
      });
      await abrirConteo(abiertoId);
    } catch (err) {
      setPanelError(err.response?.data?.error || 'No se pudieron guardar las líneas.');
    }
  }

  async function avanzarEstado() {
    setPanelError('');
    try {
      await cambiarEstadoConteo(abiertoId, { estado: SIGUIENTE_ESTADO[detalle.estado] });
      await abrirConteo(abiertoId);
      cargarConteos(paginacion.pagina);
    } catch (err) {
      setPanelError(err.response?.data?.error || 'No se pudo cambiar el estado.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Conteos físicos</h1>
        <p className="text-sm text-gray-500">Capturá el conteo, pasalo a revisión y autorizalo para aplicar el ajuste.</p>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}

      <Card title="Nuevo conteo">
        <form onSubmit={handleCrear} className="flex flex-wrap items-end gap-3">
          <Select id="sucursalConteo" label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
          <Button type="submit">Iniciar conteo</Button>
        </form>
      </Card>

      <Card title="Conteos recientes">
        <Select
          id="filtroSucursalConteo"
          label="Filtrar por sucursal"
          value={filtroSucursalId}
          onChange={(e) => setFiltroSucursalId(e.target.value)}
          className="mb-4 max-w-xs"
        >
          <option value="">Todas las sucursales</option>
          {sucursales.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </Select>
        <Table
          columnas={COLUMNAS_CONTEOS}
          ordenarPor={orden.ordenarPor}
          orden={orden.orden}
          onOrdenar={handleOrdenar}
          pie={(
            <Paginacion
              pagina={paginacion.pagina}
              totalPaginas={paginacion.totalPaginas}
              total={paginacion.total}
              onCambiar={cargarConteos}
            />
          )}
        >
          {conteos.length === 0 && <TablaVacia colSpan={4} />}
          {conteos.map((c) => (
            <Fila key={c.id}>
              <Celda>{nombreSucursal(c.sucursalId)}</Celda>
              <Celda><Badge tono={ESTADO_TONO[c.estado] || 'gray'}>{c.estado}</Badge></Celda>
              <Celda>{new Date(c.creadoEn).toLocaleString()}</Celda>
              <Celda className="text-right">
                <button type="button" onClick={() => abrirConteo(c.id)} className="text-sm text-primary-600 hover:underline">
                  Abrir
                </button>
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <Modal abierto={abiertoId !== null} onCerrar={cerrarConteo} titulo="Detalle del conteo" ancho="max-w-2xl">
        {panelError && <p className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{panelError}</p>}
        {!detalle && <p className="text-sm text-gray-500">Cargando…</p>}

        {detalle && detalle.estado === 'CAPTURA' && (
          <>
            <form onSubmit={agregarLineaCaptura} className="flex flex-wrap items-end gap-3">
              <Select
                id="capArticulo"
                label="Artículo"
                value={capArticuloId}
                onChange={(e) => setCapArticuloId(e.target.value)}
                required
                className="min-w-[220px]"
              >
                <option value="">Selecciona un artículo...</option>
                {articulos.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </Select>
              <Input
                id="capCantidad"
                label="Cantidad física"
                type="number"
                step="0.01"
                min="0"
                value={capCantidad}
                onChange={(e) => setCapCantidad(e.target.value)}
                className="w-36"
                required
              />
              <Button type="submit" variant="secondary">Agregar/actualizar</Button>
            </form>

            {capCarrito.length > 0 && (
              <div className="mt-4">
                <Table columnas={['Artículo', 'Cantidad física', '']}>
                  {capCarrito.map((l) => (
                    <Fila key={l.articuloId}>
                      <Celda>{l.nombre}</Celda>
                      <Celda>{l.cantidadFisica}</Celda>
                      <Celda className="text-right">
                        <button type="button" onClick={() => quitarLineaCaptura(l.articuloId)} className="text-gray-400 hover:text-danger-600">
                          <Trash2 size={16} />
                        </button>
                      </Celda>
                    </Fila>
                  ))}
                </Table>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button type="button" variant="secondary" onClick={guardarLineas}>Guardar líneas</Button>
              <Button type="button" onClick={avanzarEstado} disabled={detalle.detalles.length === 0}>
                Pasar a revisión
              </Button>
            </div>
          </>
        )}

        {detalle && detalle.estado !== 'CAPTURA' && (
          <>
            <Table columnas={['Artículo', 'Sistema', 'Física', 'Diferencia']}>
              {detalle.detalles.map((d) => {
                const diferencia = Number(d.cantidadFisica) - Number(d.cantidadSistema);
                return (
                  <Fila key={d.id}>
                    <Celda>{d.articulo?.nombre || d.articuloId}</Celda>
                    <Celda>{d.cantidadSistema}</Celda>
                    <Celda>{d.cantidadFisica}</Celda>
                    <Celda className={diferencia !== 0 ? 'font-medium text-warning-700' : ''}>
                      {diferencia > 0 ? `+${diferencia}` : diferencia}
                    </Celda>
                  </Fila>
                );
              })}
            </Table>
            {detalle.estado === 'REVISION' && (
              <Button type="button" onClick={avanzarEstado} className="mt-4">
                Autorizar (aplica el ajuste a existencias)
              </Button>
            )}
            {detalle.estado === 'AUTORIZADO' && (
              <p className="mt-4 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
                Conteo autorizado — ajuste ya aplicado al kardex.
              </p>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}

export default ConteosPage;
