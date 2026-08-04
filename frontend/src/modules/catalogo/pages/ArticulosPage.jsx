import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
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
} from '../api/catalogo.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';
import Modal from '../../../shared/ui/Modal';
import Paginacion from '../../../shared/ui/Paginacion';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { formatoMoneda } from '../../../shared/format';

const COLUMNAS = [
  { label: 'Nombre', clave: 'nombre', ordenable: true },
  { label: 'SKU', clave: 'sku', ordenable: true },
  { label: 'Precio', clave: 'precio', ordenable: true },
  { label: 'Activo', clave: 'activo', ordenable: true },
  { label: '', clave: null },
];

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
    activo: a.activo,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarArticulos(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden]);

  function abrirPrecios(articulo) {
    cancelarEdicion();
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

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function iniciarEdicion(articulo) {
    cerrarPrecios();
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
        activo: editForm.activo,
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
                </div>
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <Card title="Nuevo artículo">
        <form onSubmit={agregar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          {error && <p className="sm:col-span-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
          <div className="sm:col-span-2">
            <Button type="submit">Crear artículo</Button>
          </div>
        </form>
      </Card>

      <Modal abierto={editandoId !== null} onCerrar={cancelarEdicion} titulo="Editar artículo">
        <form onSubmit={guardarEdicion} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
    </div>
  );
}

export default ArticulosPage;
