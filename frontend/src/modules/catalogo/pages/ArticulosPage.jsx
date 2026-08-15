import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, ImageIcon, Upload, X } from 'lucide-react';
import { redimensionarImagen } from '../../../shared/imagen';
import {
  listarArticulos,
  crearArticulo,
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
} from '../api/catalogo.api';
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

const TAMANO_MAX_ARCHIVO = 8 * 1024 * 1024; // origen antes de redimensionar
const DIMENSION_MAX_IMAGEN_ARTICULO = 480; // px, lado más largo — de sobra para la tarjeta del POS

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

// Campo de imagen reusado en el alta y en la edición: preview cuadrado + subir/quitar. Mismo
// patrón (canvas resize -> data URI) que el logo de EmpresaPage, sin almacenamiento en el backend.
function CampoImagenArticulo({ idInput, imagenUrl, onChange }) {
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  async function handleArchivo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > TAMANO_MAX_ARCHIVO) {
      setError('La imagen es demasiado grande (máximo 8MB).');
      return;
    }
    try {
      const dataUrl = await redimensionarImagen(file, DIMENSION_MAX_IMAGEN_ARTICULO);
      onChange(dataUrl);
    } catch (err) {
      setError(err.message || 'No se pudo procesar la imagen.');
    }
  }

  return (
    <div className="sm:col-span-2 flex items-center gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        {imagenUrl ? (
          <img src={imagenUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon size={22} className="text-gray-300" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input ref={inputRef} id={idInput} type="file" accept="image/*" onChange={handleArchivo} className="hidden" />
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
          <Upload size={16} /> {imagenUrl ? 'Cambiar imagen' : 'Subir imagen'}
        </Button>
        {imagenUrl && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-danger-600"
          >
            <X size={13} /> Quitar imagen
          </button>
        )}
        {error && <p className="text-xs text-danger-600">{error}</p>}
      </div>
    </div>
  );
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
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');

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

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function iniciarEdicion(articulo) {
    cerrarPrecios();
    cerrarUnidades();
    cerrarVariantes();
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

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      await crearArticulo({
        tipo: form.tipo,
        nombre: form.nombre,
        sku: form.sku || undefined,
        codigoBarras: form.codigoBarras || undefined,
        unidadBaseId: form.unidadBaseId,
        categoriaId: form.categoriaId || undefined,
        marcaId: form.marcaId || undefined,
        impuestoId: form.impuestoId || undefined,
        costo: form.costo ? Number(form.costo) : undefined,
        precio: form.precio ? Number(form.precio) : undefined,
        stockMinimo: form.stockMinimo ? Number(form.stockMinimo) : undefined,
        stockMaximo: form.stockMaximo ? Number(form.stockMaximo) : undefined,
        claveProdServSat: form.claveProdServSat || undefined,
        imagenUrl: form.imagenUrl || undefined,
      });
      setForm(FORM_VACIO);
      cargarArticulos(1);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el artículo.');
    }
  }

  function buscarSubmit(e) {
    e.preventDefault();
    cargarArticulos(1);
  }

  const articuloEnPrecios = articulos.find((a) => a.id === preciosArticuloId);
  const articuloEnUnidades = articulos.find((a) => a.id === unidadesArticuloId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Artículos y servicios</h1>
        <p className="text-sm text-gray-500">Catálogo de productos y servicios que se pueden vender.</p>
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
                </div>
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <Card title="Nuevo artículo">
        <form onSubmit={agregar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoImagenArticulo
            idInput="imagenArticulo"
            imagenUrl={form.imagenUrl}
            onChange={(url) => actualizarCampo('imagenUrl', url)}
          />
          <Select id="tipoArticulo" label="Tipo" value={form.tipo} onChange={(e) => actualizarCampo('tipo', e.target.value)}>
            <option value="PRODUCTO">Producto</option>
            <option value="SERVICIO">Servicio</option>
          </Select>
          <Input id="nombreArticulo" label="Nombre" value={form.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
          <Input id="skuArticulo" label="SKU" value={form.sku} onChange={(e) => actualizarCampo('sku', e.target.value)} />
          <Input id="codigoBarrasArticulo" label="Código de barras" value={form.codigoBarras} onChange={(e) => actualizarCampo('codigoBarras', e.target.value)} />
          <Select id="unidadArticulo" label="Unidad base" value={form.unidadBaseId} onChange={(e) => actualizarCampo('unidadBaseId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </Select>
          <Select id="categoriaArticulo" label="Categoría" value={form.categoriaId} onChange={(e) => actualizarCampo('categoriaId', e.target.value)}>
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Select>
          <Select id="marcaArticulo" label="Marca" value={form.marcaId} onChange={(e) => actualizarCampo('marcaId', e.target.value)}>
            <option value="">Sin marca</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </Select>
          <Select id="impuestoArticulo" label="Impuesto" value={form.impuestoId} onChange={(e) => actualizarCampo('impuestoId', e.target.value)}>
            <option value="">Sin impuesto</option>
            {impuestos.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre}</option>
            ))}
          </Select>
          <Input id="costoArticulo" label="Costo" type="number" step="0.01" value={form.costo} onChange={(e) => actualizarCampo('costo', e.target.value)} />
          <Input id="precioArticulo" label="Precio" type="number" step="0.01" value={form.precio} onChange={(e) => actualizarCampo('precio', e.target.value)} />
          <Input
            id="stockMinimoArticulo"
            label="Stock mínimo (opcional)"
            type="number"
            step="0.01"
            min="0"
            value={form.stockMinimo}
            onChange={(e) => actualizarCampo('stockMinimo', e.target.value)}
          />
          <SelectorCatalogoSat
            id="claveProdServArticulo"
            tipo="ClaveProdServ"
            label="Clave prod/serv SAT (opcional)"
            value={form.claveProdServSat}
            onChange={(v) => actualizarCampo('claveProdServSat', v)}
            placeholder="Buscar clave SAT…"
          />
          <Input
            id="stockMaximoArticulo"
            label="Stock máximo (opcional)"
            type="number"
            step="0.01"
            min="0"
            value={form.stockMaximo}
            onChange={(e) => actualizarCampo('stockMaximo', e.target.value)}
          />
          {error && <p className="sm:col-span-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
          <div className="sm:col-span-2">
            <Button type="submit">Crear artículo</Button>
          </div>
        </form>
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
    </div>
  );
}

export default ArticulosPage;
