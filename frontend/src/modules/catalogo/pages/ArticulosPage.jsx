import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import {
  listarArticulos,
  actualizarArticulo,
  listarCategorias,
  listarMarcas,
  listarUnidades,
  listarImpuestos,
  listarListasPrecio,
  actualizarPreciosArticulo,
  actualizarUnidadesAlternas,
  listarAtributos,
  obtenerArticulo,
  generarVariantesArticulo,
  actualizarKitDetalle,
} from '../api/catalogo.api';
import CampoImagenArticulo from '../components/CampoImagenArticulo';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';
import Modal from '../../../shared/ui/Modal';
import Paginacion from '../../../shared/ui/Paginacion';
import SelectorCatalogoSat from '../../../shared/ui/SelectorCatalogoSat';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { formatoMoneda } from '../../../shared/format';

const COLUMNAS = [
  { label: 'Nombre', clave: 'nombre', ordenable: true },
  { label: 'SKU', clave: 'sku', ordenable: true },
  { label: 'Precio', clave: 'precio', ordenable: true },
  { label: 'Activo', clave: 'activo', ordenable: true },
  { label: '', clave: null },
];

// Placeholder para editForm antes de que iniciarEdicion() lo sobrescriba con articuloAForm() —
// el alta real vive en ArticuloNuevoPage.jsx.
const FORM_VACIO = {
  tipo: 'PRODUCTO',
  nombre: '',
  sku: '',
  codigoBarras: '',
  unidadBaseId: '',
  categoriaId: '',
  marcaId: '',
  impuestoId: '',
  costo: '',
  precio: '',
  stockMinimo: '',
  stockMaximo: '',
  claveProdServSat: null,
  imagenUrl: null,
};

function articuloAForm(a) {
  return {
    tipo: a.tipo,
    nombre: a.nombre,
    sku: a.sku || '',
    codigoBarras: a.codigoBarras || '',
    unidadBaseId: a.unidadBaseId,
    categoriaId: a.categoriaId || '',
    marcaId: a.marcaId || '',
    impuestoId: a.impuestoId || '',
    costo: String(a.costo),
    precio: String(a.precio),
    stockMinimo: a.stockMinimo === null || a.stockMinimo === undefined ? '' : String(a.stockMinimo),
    stockMaximo: a.stockMaximo === null || a.stockMaximo === undefined ? '' : String(a.stockMaximo),
    activo: a.activo,
    claveProdServSat: a.claveProdServSat || null,
    imagenUrl: a.imagenUrl || null,
  };
}

function ArticulosPage() {
  const location = useLocation();
  const [articulos, setArticulos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [impuestos, setImpuestos] = useState([]);
  const [listasPrecio, setListasPrecio] = useState([]);
  const [atributos, setAtributos] = useState([]);
  // Prefil con el término que trajo el buscador global de la barra superior (TopBar.jsx),
  // si se llegó a esta pantalla haciendo clic en un resultado de esa categoría.
  const [buscar, setBuscar] = useState(() => location.state?.buscar || '');
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [orden, setOrden] = useState({ ordenarPor: 'nombre', orden: 'asc' });

  const [preciosArticuloId, setPreciosArticuloId] = useState(null);
  const [preciosForm, setPreciosForm] = useState({});
  const [preciosError, setPreciosError] = useState('');

  const [unidadesArticuloId, setUnidadesArticuloId] = useState(null);
  const [unidadesForm, setUnidadesForm] = useState({});
  const [unidadesError, setUnidadesError] = useState('');

  const [variantesArticuloId, setVariantesArticuloId] = useState(null);
  const [variantesDetalle, setVariantesDetalle] = useState(null);
  const [valorIdsSeleccionados, setValorIdsSeleccionados] = useState([]);
  const [variantesError, setVariantesError] = useState('');
  const [generandoVariantes, setGenerandoVariantes] = useState(false);

  // Catálogo completo (sin paginar) solo para el buscador de componentes del modal de Kits —
  // `articulos` de arriba trae únicamente la página actual, no alcanza para buscar cualquier
  // producto de la empresa.
  const [catalogoCompleto, setCatalogoCompleto] = useState([]);
  const [kitArticuloId, setKitArticuloId] = useState(null);
  const [kitComponentes, setKitComponentes] = useState([]);
  const [kitBusqueda, setKitBusqueda] = useState('');
  const [kitError, setKitError] = useState('');
  const [kitCargando, setKitCargando] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState(FORM_VACIO);
  const [errorEdit, setErrorEdit] = useState('');

  function cargarArticulos(pagina = 1) {
    listarArticulos({
      buscar: buscar || undefined,
      pagina,
      porPagina: 20,
      ordenarPor: orden.ordenarPor,
      orden: orden.orden,
    })
      .then((r) => {
        setArticulos(r.datos);
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
    listarCategorias().then(setCategorias).catch(() => {});
    listarMarcas().then(setMarcas).catch(() => {});
    listarUnidades().then(setUnidades).catch(() => {});
    listarImpuestos().then(setImpuestos).catch(() => {});
    listarListasPrecio().then(setListasPrecio).catch(() => {});
    listarAtributos().then(setAtributos).catch(() => {});
    listarArticulos().then(setCatalogoCompleto).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarArticulos(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden]);

  function abrirPrecios(articulo) {
    cancelarEdicion();
    cerrarUnidades();
    cerrarVariantes();
    cerrarKit();
    setPreciosError('');
    setPreciosArticuloId(articulo.id);
    const inicial = {};
    for (const p of articulo.precios || []) inicial[p.listaPrecioId] = String(p.precio);
    setPreciosForm(inicial);
  }

  function cerrarPrecios() {
    setPreciosArticuloId(null);
    setPreciosForm({});
  }

  async function guardarPrecios(e) {
    e.preventDefault();
    setPreciosError('');
    const precios = Object.entries(preciosForm)
      .filter(([, valor]) => valor !== '')
      .map(([listaPrecioId, valor]) => ({ listaPrecioId, precio: Number(valor) }));
    try {
      await actualizarPreciosArticulo(preciosArticuloId, precios);
      cerrarPrecios();
      cargarArticulos(paginacion.pagina);
    } catch (err) {
      setPreciosError(err.response?.data?.error || 'No se pudieron guardar los precios.');
    }
  }

  function abrirUnidades(articulo) {
    cancelarEdicion();
    cerrarPrecios();
    cerrarVariantes();
    cerrarKit();
    setUnidadesError('');
    setUnidadesArticuloId(articulo.id);
    const inicial = {};
    for (const u of articulo.unidadesAlternas || []) inicial[u.unidadId] = String(u.factor);
    setUnidadesForm(inicial);
  }

  function cerrarUnidades() {
    setUnidadesArticuloId(null);
    setUnidadesForm({});
  }

  async function guardarUnidades(e) {
    e.preventDefault();
    setUnidadesError('');
    const unidadesAlternas = Object.entries(unidadesForm)
      .filter(([, valor]) => valor !== '')
      .map(([unidadId, valor]) => ({ unidadId, factor: Number(valor) }));
    try {
      await actualizarUnidadesAlternas(unidadesArticuloId, unidadesAlternas);
      cerrarUnidades();
      cargarArticulos(paginacion.pagina);
    } catch (err) {
      setUnidadesError(err.response?.data?.error || 'No se pudieron guardar las unidades alternas.');
    }
  }

  function abrirVariantes(articulo) {
    cancelarEdicion();
    cerrarPrecios();
    cerrarUnidades();
    cerrarKit();
    setVariantesError('');
    setValorIdsSeleccionados([]);
    setVariantesArticuloId(articulo.id);
    setVariantesDetalle(null);
    obtenerArticulo(articulo.id).then(setVariantesDetalle).catch(() => {
      setVariantesError('No se pudo cargar el detalle de variantes.');
    });
  }

  function cerrarVariantes() {
    setVariantesArticuloId(null);
    setVariantesDetalle(null);
    setValorIdsSeleccionados([]);
    setVariantesError('');
  }

  function abrirKit(articulo) {
    cancelarEdicion();
    cerrarPrecios();
    cerrarUnidades();
    cerrarVariantes();
    setKitError('');
    setKitBusqueda('');
    setKitComponentes([]);
    setKitArticuloId(articulo.id);
    setKitCargando(true);
    obtenerArticulo(articulo.id)
      .then((detalle) => {
        setKitComponentes(
          (detalle.kitComponentes || []).map((c) => ({
            articuloComponenteId: c.articuloComponenteId,
            cantidad: String(c.cantidad),
            nombre: c.articuloComponente?.nombre,
            sku: c.articuloComponente?.sku,
          })),
        );
      })
      .catch(() => setKitError('No se pudo cargar los componentes del kit.'))
      .finally(() => setKitCargando(false));
  }

  function cerrarKit() {
    setKitArticuloId(null);
    setKitComponentes([]);
    setKitBusqueda('');
    setKitError('');
  }

  function agregarComponenteKit(articulo) {
    setKitComponentes((c) => (
      c.some((x) => x.articuloComponenteId === articulo.id)
        ? c
        : [...c, { articuloComponenteId: articulo.id, cantidad: '1', nombre: articulo.nombre, sku: articulo.sku }]
    ));
    setKitBusqueda('');
  }

  function quitarComponenteKit(articuloComponenteId) {
    setKitComponentes((c) => c.filter((x) => x.articuloComponenteId !== articuloComponenteId));
  }

  function actualizarCantidadComponenteKit(articuloComponenteId, cantidad) {
    setKitComponentes((c) => c.map((x) => (
      x.articuloComponenteId === articuloComponenteId ? { ...x, cantidad } : x
    )));
  }

  async function guardarKit(e) {
    e.preventDefault();
    setKitError('');
    const componentes = kitComponentes
      .filter((c) => c.cantidad !== '' && Number(c.cantidad) > 0)
      .map((c) => ({ articuloComponenteId: c.articuloComponenteId, cantidad: Number(c.cantidad) }));
    try {
      await actualizarKitDetalle(kitArticuloId, componentes);
      cerrarKit();
      cargarArticulos(paginacion.pagina);
    } catch (err) {
      setKitError(err.response?.data?.error || 'No se pudieron guardar los componentes.');
    }
  }

  function toggleValor(valorId) {
    setValorIdsSeleccionados((sel) => (
      sel.includes(valorId) ? sel.filter((id) => id !== valorId) : [...sel, valorId]
    ));
  }

  async function handleGenerarVariantes(e) {
    e.preventDefault();
    setVariantesError('');
    if (valorIdsSeleccionados.length === 0) {
      setVariantesError('Selecciona al menos un valor de atributo.');
      return;
    }
    setGenerandoVariantes(true);
    try {
      const actualizado = await generarVariantesArticulo(variantesArticuloId, valorIdsSeleccionados);
      setVariantesDetalle(actualizado);
      setValorIdsSeleccionados([]);
      cargarArticulos(paginacion.pagina);
    } catch (err) {
      setVariantesError(err.response?.data?.error || 'No se pudieron generar las variantes.');
    } finally {
      setGenerandoVariantes(false);
    }
  }

  function iniciarEdicion(articulo) {
    cerrarPrecios();
    cerrarUnidades();
    cerrarVariantes();
    cerrarKit();
    setErrorEdit('');
    setEditandoId(articulo.id);
    setEditForm(articuloAForm(articulo));
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setErrorEdit('');
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    setErrorEdit('');
    try {
      await actualizarArticulo(editandoId, {
        tipo: editForm.tipo,
        nombre: editForm.nombre,
        // A diferencia del alta, aquí "" significa "quitar lo que había" -> null explícito,
        // no "sin cambios" (actualizarArticuloSchema acepta null para estos campos).
        sku: editForm.sku || null,
        codigoBarras: editForm.codigoBarras || null,
        unidadBaseId: editForm.unidadBaseId,
        categoriaId: editForm.categoriaId || null,
        marcaId: editForm.marcaId || null,
        impuestoId: editForm.impuestoId || null,
        costo: editForm.costo === '' ? undefined : Number(editForm.costo),
        precio: editForm.precio === '' ? undefined : Number(editForm.precio),
        // Igual que sku/codigoBarras: "" significa "quitar el límite que había" -> null
        // explícito, para poder volver a dejar el stock mínimo/máximo sin definir.
        stockMinimo: editForm.stockMinimo === '' ? null : Number(editForm.stockMinimo),
        stockMaximo: editForm.stockMaximo === '' ? null : Number(editForm.stockMaximo),
        activo: editForm.activo,
        claveProdServSat: editForm.claveProdServSat,
        imagenUrl: editForm.imagenUrl,
      });
      setEditandoId(null);
      cargarArticulos(paginacion.pagina);
    } catch (err) {
      setErrorEdit(err.response?.data?.error || 'No se pudo actualizar el artículo.');
    }
  }

  function buscarSubmit(e) {
    e.preventDefault();
    cargarArticulos(1);
  }

  const articuloEnPrecios = articulos.find((a) => a.id === preciosArticuloId);
  const articuloEnUnidades = articulos.find((a) => a.id === unidadesArticuloId);

  // Candidatos a componente: solo Producto activo de esta empresa, sin el kit mismo ni lo que
  // ya está agregado — un kit no puede tener kits ni servicios como pieza (mismo criterio que
  // valida el backend en setKitDetalle).
  const componentesFiltrados = kitBusqueda.trim()
    ? catalogoCompleto.filter((a) => {
      if (a.tipo !== 'PRODUCTO' || !a.activo || a.id === kitArticuloId) return false;
      if (kitComponentes.some((c) => c.articuloComponenteId === a.id)) return false;
      const texto = kitBusqueda.trim().toLowerCase();
      return (
        a.nombre.toLowerCase().includes(texto)
        || (a.sku || '').toLowerCase().includes(texto)
        || (a.codigoBarras || '').toLowerCase().includes(texto)
      );
    }).slice(0, 8)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Artículos y servicios</h1>
          <p className="text-sm text-gray-500">Catálogo de productos y servicios que se pueden vender.</p>
        </div>
        <Link
          to="/catalogo/articulos/nuevo"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Nuevo artículo
        </Link>
      </div>

      {unidades.length === 0 && (
        <p className="rounded-lg bg-warning-50 px-4 py-2.5 text-sm text-warning-700">
          Primero creá al menos una <Link to="/catalogo/configuracion" className="font-medium underline">unidad</Link> para poder dar de alta artículos.
        </p>
      )}

      <Card>
        <form onSubmit={buscarSubmit} className="flex items-end gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-[38px] text-gray-400" />
            <Input
              id="buscarArticulo"
              label="Buscar"
              placeholder="Nombre, SKU o código de barras"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">Buscar</Button>
        </form>
      </Card>

      <Card title="Artículos">
        <Table
          columnas={COLUMNAS}
          ordenarPor={orden.ordenarPor}
          orden={orden.orden}
          onOrdenar={handleOrdenar}
          pie={(
            <Paginacion
              pagina={paginacion.pagina}
              totalPaginas={paginacion.totalPaginas}
              total={paginacion.total}
              onCambiar={cargarArticulos}
            />
          )}
        >
          {articulos.length === 0 && <TablaVacia colSpan={5} />}
          {articulos.map((a) => (
            <Fila key={a.id}>
              <Celda className="font-medium text-gray-800">{a.nombre}</Celda>
              <Celda>{a.sku || '—'}</Celda>
              <Celda>{formatoMoneda(a.precio)}</Celda>
              <Celda><Badge tono={a.activo ? 'success' : 'gray'}>{a.activo ? 'Sí' : 'No'}</Badge></Celda>
              <Celda className="text-right">
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => iniciarEdicion(a)} className="text-sm text-primary-600 hover:underline">
                    Editar
                  </button>
                  {listasPrecio.length > 0 && (
                    <button type="button" onClick={() => abrirPrecios(a)} className="text-sm text-primary-600 hover:underline">
                      Precios
                    </button>
                  )}
                  {unidades.length > 1 && (
                    <button type="button" onClick={() => abrirUnidades(a)} className="text-sm text-primary-600 hover:underline">
                      Unidades
                    </button>
                  )}
                  {atributos.length > 0 && (
                    <button type="button" onClick={() => abrirVariantes(a)} className="text-sm text-primary-600 hover:underline">
                      Variantes{a._count?.variantes > 0 ? ` (${a._count.variantes})` : ''}
                    </button>
                  )}
                  {a.tipo === 'KIT' && (
                    <button type="button" onClick={() => abrirKit(a)} className="text-sm text-primary-600 hover:underline">
                      Componentes
                    </button>
                  )}
                </div>
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <Modal abierto={editandoId !== null} onCerrar={cancelarEdicion} titulo="Editar artículo">
        <form onSubmit={guardarEdicion} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoImagenArticulo
            idInput="imagenEdit"
            imagenUrl={editForm.imagenUrl}
            onChange={(url) => setEditForm((f) => ({ ...f, imagenUrl: url }))}
          />
          <Select id="tipoEdit" label="Tipo" value={editForm.tipo} onChange={(e) => setEditForm((f) => ({ ...f, tipo: e.target.value }))}>
            <option value="PRODUCTO">Producto</option>
            <option value="SERVICIO">Servicio</option>
            <option value="KIT">Kit (combo de otros artículos)</option>
          </Select>
          <Input id="nombreEdit" label="Nombre" value={editForm.nombre} onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))} required />
          <Input id="skuEdit" label="SKU" value={editForm.sku} onChange={(e) => setEditForm((f) => ({ ...f, sku: e.target.value }))} />
          <Input id="codigoBarrasEdit" label="Código de barras" value={editForm.codigoBarras} onChange={(e) => setEditForm((f) => ({ ...f, codigoBarras: e.target.value }))} />
          <Select id="unidadEdit" label="Unidad base" value={editForm.unidadBaseId} onChange={(e) => setEditForm((f) => ({ ...f, unidadBaseId: e.target.value }))} required>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </Select>
          <Select id="categoriaEdit" label="Categoría" value={editForm.categoriaId} onChange={(e) => setEditForm((f) => ({ ...f, categoriaId: e.target.value }))}>
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Select>
          <Select id="marcaEdit" label="Marca" value={editForm.marcaId} onChange={(e) => setEditForm((f) => ({ ...f, marcaId: e.target.value }))}>
            <option value="">Sin marca</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </Select>
          <Select id="impuestoEdit" label="Impuesto" value={editForm.impuestoId} onChange={(e) => setEditForm((f) => ({ ...f, impuestoId: e.target.value }))}>
            <option value="">Sin impuesto</option>
            {impuestos.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre}</option>
            ))}
          </Select>
          <Input id="costoEdit" label="Costo" type="number" step="0.01" value={editForm.costo} onChange={(e) => setEditForm((f) => ({ ...f, costo: e.target.value }))} />
          <Input id="precioEdit" label="Precio" type="number" step="0.01" value={editForm.precio} onChange={(e) => setEditForm((f) => ({ ...f, precio: e.target.value }))} />
          <Input
            id="stockMinimoEdit"
            label="Stock mínimo (opcional)"
            type="number"
            step="0.01"
            min="0"
            placeholder="Sin definir"
            value={editForm.stockMinimo}
            onChange={(e) => setEditForm((f) => ({ ...f, stockMinimo: e.target.value }))}
          />
          <Input
            id="stockMaximoEdit"
            label="Stock máximo (opcional)"
            type="number"
            step="0.01"
            min="0"
            placeholder="Sin definir"
            value={editForm.stockMaximo}
            onChange={(e) => setEditForm((f) => ({ ...f, stockMaximo: e.target.value }))}
          />
          <SelectorCatalogoSat
            id="claveProdServEdit"
            tipo="ClaveProdServ"
            label="Clave prod/serv SAT (opcional)"
            value={editForm.claveProdServSat}
            onChange={(v) => setEditForm((f) => ({ ...f, claveProdServSat: v }))}
            placeholder="Buscar clave SAT…"
          />
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={editForm.activo}
              onChange={(e) => setEditForm((f) => ({ ...f, activo: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Activo (desmarcá para descontinuarlo — deja de poderse vender)
          </label>
          {errorEdit && <p className="sm:col-span-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{errorEdit}</p>}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={cancelarEdicion}>Cancelar</Button>
            <Button type="submit">Guardar cambios</Button>
          </div>
        </form>
      </Modal>

      <Modal abierto={preciosArticuloId !== null} onCerrar={cerrarPrecios} titulo="Precios por lista">
        <form onSubmit={guardarPrecios} className="flex flex-col gap-3">
          {listasPrecio.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">{l.nombre}</span>
              <Input
                id={`precio-${l.id}`}
                type="number"
                step="0.01"
                min="0"
                placeholder={`base: ${articuloEnPrecios?.precio ?? ''}`}
                value={preciosForm[l.id] ?? ''}
                onChange={(e) => setPreciosForm((f) => ({ ...f, [l.id]: e.target.value }))}
                className="w-32"
              />
            </div>
          ))}
          {preciosError && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{preciosError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={cerrarPrecios}>Cancelar</Button>
            <Button type="submit">Guardar precios</Button>
          </div>
        </form>
      </Modal>

      <Modal abierto={unidadesArticuloId !== null} onCerrar={cerrarUnidades} titulo="Unidades alternas">
        <form onSubmit={guardarUnidades} className="flex flex-col gap-3">
          <p className="text-sm text-gray-500">
            Unidad base: <span className="font-medium text-gray-700">{articuloEnUnidades?.unidadBase?.nombre}</span>.
            Definí cuántas unidades base equivalen a cada unidad alterna (ej. Caja = 12 si la base es Pieza).
            Se usan al capturar una compra en esa unidad.
          </p>
          {unidades
            .filter((u) => u.id !== articuloEnUnidades?.unidadBaseId)
            .map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700">{u.nombre}</span>
                <Input
                  id={`unidad-${u.id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="No aplica"
                  value={unidadesForm[u.id] ?? ''}
                  onChange={(e) => setUnidadesForm((f) => ({ ...f, [u.id]: e.target.value }))}
                  className="w-32"
                />
              </div>
            ))}
          {unidadesError && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{unidadesError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={cerrarUnidades}>Cancelar</Button>
            <Button type="submit">Guardar unidades</Button>
          </div>
        </form>
      </Modal>

      <Modal abierto={variantesArticuloId !== null} onCerrar={cerrarVariantes} titulo="Variantes">
        {!variantesDetalle && !variantesError && <p className="text-sm text-gray-500">Cargando...</p>}
        {variantesDetalle && (
          <div className="flex flex-col gap-4">
            <form onSubmit={handleGenerarVariantes} className="flex flex-col gap-3">
              <p className="text-sm text-gray-500">
                Elegí los valores a combinar — cada combinación nueva genera una variante (artículo
                propio, con su propio SKU/precio/stock). Las combinaciones ya generadas no se tocan.
              </p>
              {atributos.map((atr) => (
                <div key={atr.id}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{atr.nombre}</p>
                  <div className="mt-1 flex flex-wrap gap-3">
                    {atr.valores.map((v) => (
                      <label key={v.id} className="flex items-center gap-1.5 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={valorIdsSeleccionados.includes(v.id)}
                          onChange={() => toggleValor(v.id)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        {v.valor}
                      </label>
                    ))}
                    {atr.valores.length === 0 && <span className="text-xs text-gray-400">Sin valores todavía.</span>}
                  </div>
                </div>
              ))}
              {atributos.length === 0 && (
                <p className="text-sm text-gray-400">
                  No hay atributos configurados todavía — creá alguno en Configuración de catálogo.
                </p>
              )}
              {variantesError && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{variantesError}</p>}
              <div className="flex justify-end">
                <Button type="submit" disabled={generandoVariantes}>
                  {generandoVariantes ? 'Generando...' : 'Generar variantes'}
                </Button>
              </div>
            </form>

            <div className="border-t border-gray-100 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Variantes generadas ({variantesDetalle.variantes.length})
              </p>
              <ul className="divide-y divide-gray-100">
                {variantesDetalle.variantes.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-800">{v.nombre}</p>
                      <p className="text-xs text-gray-500">
                        {v.sku || 'Sin SKU'} · {formatoMoneda(v.precio)}
                        {!v.activo && <Badge tono="gray">inactivo</Badge>}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => iniciarEdicion(v)}
                      className="shrink-0 text-sm text-primary-600 hover:underline"
                    >
                      Editar
                    </button>
                  </li>
                ))}
                {variantesDetalle.variantes.length === 0 && (
                  <li className="py-2 text-sm text-gray-400">Todavía no se generó ninguna variante.</li>
                )}
              </ul>
            </div>
          </div>
        )}
        {variantesError && !variantesDetalle && (
          <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{variantesError}</p>
        )}
      </Modal>

      <Modal abierto={kitArticuloId !== null} onCerrar={cerrarKit} titulo="Componentes del kit">
        {kitCargando && <p className="text-sm text-gray-500">Cargando...</p>}
        {!kitCargando && (
          <form onSubmit={guardarKit} className="flex flex-col gap-3">
            <p className="text-sm text-gray-500">
              Elegí qué artículos integran este kit y en qué cantidad (en su unidad base). Al
              vender el kit se descuenta stock de cada componente automáticamente.
            </p>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-3 text-gray-400" />
              <Input
                id="buscarComponenteKit"
                placeholder="Buscar producto por nombre, SKU o código de barras"
                value={kitBusqueda}
                onChange={(e) => setKitBusqueda(e.target.value)}
                className="pl-9"
              />
              {componentesFiltrados.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                  {componentesFiltrados.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => agregarComponenteKit(a)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-primary-50"
                      >
                        <span className="text-gray-800">{a.nombre}</span>
                        <span className="shrink-0 text-xs text-gray-400">{a.sku || '—'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <ul className="divide-y divide-gray-100">
              {kitComponentes.map((c) => (
                <li key={c.articuloComponenteId} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-800">{c.nombre}</p>
                    <p className="text-xs text-gray-500">{c.sku || 'Sin SKU'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Input
                      id={`cantidad-${c.articuloComponenteId}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={c.cantidad}
                      onChange={(e) => actualizarCantidadComponenteKit(c.articuloComponenteId, e.target.value)}
                      className="w-24"
                    />
                    <button
                      type="button"
                      onClick={() => quitarComponenteKit(c.articuloComponenteId)}
                      className="text-gray-400 hover:text-danger-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </li>
              ))}
              {kitComponentes.length === 0 && (
                <li className="py-2 text-sm text-gray-400">Este kit todavía no tiene componentes.</li>
              )}
            </ul>

            {kitError && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{kitError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={cerrarKit}>Cancelar</Button>
              <Button type="submit">Guardar componentes</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default ArticulosPage;
