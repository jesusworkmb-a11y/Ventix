import { useEffect, useState } from 'react';
import {
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  listarMarcas,
  crearMarca,
  actualizarMarca,
  listarUnidades,
  crearUnidad,
  actualizarUnidad,
  listarImpuestos,
  crearImpuesto,
  actualizarImpuesto,
  listarListasPrecio,
  crearListaPrecio,
  listarArticulos,
  listarDescuentos,
  crearDescuento,
  actualizarDescuento,
  listarPromociones,
  crearPromocion,
  actualizarPromocion,
} from '../api/catalogo.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';
import { useAuth } from '../../../shared/context/AuthContext';

// Categorías tiene lógica propia (padre + límite de 2 niveles), por eso no usa SeccionSimple.
function SeccionCategorias() {
  const [categorias, setCategorias] = useState([]);
  const [nombre, setNombre] = useState('');
  const [padreId, setPadreId] = useState('');
  const [error, setError] = useState('');

  const [editandoId, setEditandoId] = useState(null);
  const [editNombre, setEditNombre] = useState('');
  const [editPadreId, setEditPadreId] = useState('');
  const [errorEdit, setErrorEdit] = useState('');

  function cargar() {
    listarCategorias().then(setCategorias).catch(() => {});
  }

  useEffect(() => {
    cargar();
  }, []);

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      await crearCategoria({ nombre, categoriaPadreId: padreId || undefined });
      setNombre('');
      setPadreId('');
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la categoría.');
    }
  }

  function iniciarEdicion(categoria) {
    setErrorEdit('');
    setEditandoId(categoria.id);
    setEditNombre(categoria.nombre);
    setEditPadreId(categoria.categoriaPadreId || '');
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setErrorEdit('');
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    setErrorEdit('');
    try {
      await actualizarCategoria(editandoId, { nombre: editNombre, categoriaPadreId: editPadreId || null });
      setEditandoId(null);
      cargar();
    } catch (err) {
      setErrorEdit(err.response?.data?.error || 'No se pudo actualizar la categoría.');
    }
  }

  const padresPosibles = categorias.filter((c) => !c.categoriaPadreId);

  return (
    <Card title="Categorías">
      <ul className="divide-y divide-gray-100">
        {categorias.map((c) => (
          <li key={c.id} className="py-2.5">
            {editandoId === c.id ? (
              <form onSubmit={guardarEdicion} className="flex flex-wrap items-end gap-3">
                <Input id={`catNombre-${c.id}`} value={editNombre} onChange={(e) => setEditNombre(e.target.value)} required className="w-40" />
                <Select id={`catPadre-${c.id}`} value={editPadreId} onChange={(e) => setEditPadreId(e.target.value)} className="w-48">
                  <option value="">Sin categoría padre</option>
                  {padresPosibles.filter((p) => p.id !== c.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </Select>
                <Button type="submit" variant="secondary">Guardar</Button>
                <Button type="button" variant="ghost" onClick={cancelarEdicion}>Cancelar</Button>
                {errorEdit && <p className="w-full rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{errorEdit}</p>}
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">
                  {c.nombre}{c.categoriaPadreId ? <Badge tono="gray">subcategoría</Badge> : ''}
                </span>
                <button type="button" onClick={() => iniciarEdicion(c)} className="text-sm text-primary-600 hover:underline">
                  Editar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={agregar} className="mt-4 flex flex-wrap items-end gap-3">
        <Input id="catNombreNueva" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required className="w-48" />
        <Select id="catPadreNueva" label="Categoría padre" value={padreId} onChange={(e) => setPadreId(e.target.value)} className="w-48">
          <option value="">Sin categoría padre</option>
          {padresPosibles.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">Agregar</Button>
      </form>
      {error && <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
    </Card>
  );
}

// Marcas/Unidades/Impuestos son solo "lista + mini-form"; una sección genérica evita repetir
// el mismo bloque 3 veces con la única diferencia siendo los campos del formulario. `actualizar`
// es opcional: si se pasa, cada item se puede editar inline con los mismos `campos`.
function SeccionSimple({ titulo, cargar, crear, actualizar, campos, renderItem }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [errorEdit, setErrorEdit] = useState('');

  function recargar() {
    cargar().then(setItems).catch(() => {});
  }

  useEffect(() => {
    recargar();
  }, []);

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      await crear(form);
      setForm({});
      recargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear.');
    }
  }

  function iniciarEdicion(item) {
    setErrorEdit('');
    setEditandoId(item.id);
    const inicial = {};
    for (const campo of campos) inicial[campo.nombre] = item[campo.nombre] ?? '';
    setEditForm(inicial);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setErrorEdit('');
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    setErrorEdit('');
    try {
      await actualizar(editandoId, editForm);
      setEditandoId(null);
      recargar();
    } catch (err) {
      setErrorEdit(err.response?.data?.error || 'No se pudo actualizar.');
    }
  }

  return (
    <Card title={titulo}>
      <ul className="divide-y divide-gray-100">
        {items.map((item) => (
          <li key={item.id} className="py-2.5">
            {editandoId === item.id ? (
              <form onSubmit={guardarEdicion} className="flex flex-wrap items-end gap-3">
                {campos.map((campo) => (
                  <Input
                    key={campo.nombre}
                    id={`${titulo}-${item.id}-${campo.nombre}`}
                    label={campo.label}
                    type={campo.tipo || 'text'}
                    step={campo.tipo === 'number' ? '0.01' : undefined}
                    value={editForm[campo.nombre] ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, [campo.nombre]: e.target.value }))}
                    required={campo.requerido}
                    className="w-40"
                  />
                ))}
                <Button type="submit" variant="secondary">Guardar</Button>
                <Button type="button" variant="ghost" onClick={cancelarEdicion}>Cancelar</Button>
                {errorEdit && <p className="w-full rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{errorEdit}</p>}
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{renderItem(item)}</span>
                {actualizar && (
                  <button type="button" onClick={() => iniciarEdicion(item)} className="text-sm text-primary-600 hover:underline">
                    Editar
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={agregar} className="mt-4 flex flex-wrap items-end gap-3">
        {campos.map((campo) => (
          <Input
            key={campo.nombre}
            id={`${titulo}-nuevo-${campo.nombre}`}
            label={campo.label}
            type={campo.tipo || 'text'}
            step={campo.tipo === 'number' ? '0.01' : undefined}
            value={form[campo.nombre] || ''}
            onChange={(e) => setForm((f) => ({ ...f, [campo.nombre]: e.target.value }))}
            required={campo.requerido}
            className="w-40"
          />
        ))}
        <Button type="submit" variant="secondary">Agregar</Button>
      </form>
      {error && <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
    </Card>
  );
}

// Listas de precio tiene su propio checkbox (esBase), por eso no usa SeccionSimple.
function SeccionListasPrecio() {
  const [listas, setListas] = useState([]);
  const [nombre, setNombre] = useState('');
  const [esBase, setEsBase] = useState(false);
  const [error, setError] = useState('');

  function cargar() {
    listarListasPrecio().then(setListas).catch(() => {});
  }

  useEffect(() => {
    cargar();
  }, []);

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      await crearListaPrecio({ nombre, esBase });
      setNombre('');
      setEsBase(false);
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la lista de precio.');
    }
  }

  return (
    <Card title="Listas de precio">
      <p className="mb-4 text-sm text-gray-500">
        Asigná precios por artículo a cada lista en <em>Artículos</em>, y una lista a cada cliente en{' '}
        <em>Clientes</em> — al vender, se cobra el precio de la lista del cliente si existe uno definido
        ahí para ese artículo; si no, el precio base del catálogo.
      </p>
      <ul className="divide-y divide-gray-100">
        {listas.map((l) => (
          <li key={l.id} className="py-2 text-sm text-gray-700">
            {l.nombre}{l.esBase ? <Badge tono="primary">base</Badge> : ''}
          </li>
        ))}
      </ul>
      <form onSubmit={agregar} className="mt-4 flex flex-wrap items-end gap-3">
        <Input id="listaPrecioNombre" label="Nombre" placeholder="ej. Mayoreo" value={nombre} onChange={(e) => setNombre(e.target.value)} required className="w-48" />
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={esBase}
            onChange={(e) => setEsBase(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Es base
        </label>
        <Button type="submit" variant="secondary">Agregar</Button>
      </form>
      {error && <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
    </Card>
  );
}

const TIPOS_DESCUENTO = [
  { value: 'PORCENTAJE', label: 'Porcentaje' },
  { value: 'MONTO_FIJO', label: 'Monto fijo' },
];

// Los <select> de tipo/alcance muestran una opción por defecto apenas se renderizan (ver el
// `??` en su `value` más abajo), pero eso es solo visual: si el usuario nunca toca el
// desplegable, el estado del formulario nunca guarda ese valor y se manda "" al backend, que
// lo rechaza por ser un campo obligatorio ("Datos de descuento/promoción inválidos"). Por eso
// el formulario se inicializa (y se resetea tras crear) con estos valores reales en el estado,
// no solo mostrados en pantalla.
function valoresInicialesFormulario(esPromocion) {
  return esPromocion
    ? { alcance: 'ARTICULO' }
    : { tipo: 'PORCENTAJE', alcance: 'TODOS' };
}

function describirAlcance(item, categorias, articulos) {
  if (item.alcance === 'TODOS') return 'Todos los artículos';
  if (item.alcance === 'CATEGORIA') {
    return `Categoría: ${categorias.find((c) => c.id === item.categoriaId)?.nombre || '—'}`;
  }
  return `Artículo: ${articulos.find((a) => a.id === item.articuloId)?.nombre || '—'}`;
}

// Quita claves con string vacío (para no mandar "" donde el backend espera un valor válido u
// omitido) y convierte '' a null en los campos que sí se pueden despejar al editar.
function limpiarPayload(datos, campoNulleables = []) {
  const limpio = {};
  for (const [clave, valor] of Object.entries(datos)) {
    if (valor === '' || valor === undefined) {
      if (campoNulleables.includes(clave)) limpio[clave] = null;
      continue;
    }
    limpio[clave] = valor;
  }
  return limpio;
}

// Descuento (nombre + %/monto fijo) y Promoción (NxM, ej. 2x1) comparten alcance
// (todos/categoría/artículo), vigencia opcional y el checkbox de aprobación de supervisor —
// por eso comparten este formulario, con `esPromocion` cambiando los campos específicos.
function FormularioDescuentoPromocion({ valores, onChange, categorias, articulos, esPromocion, idPrefijo }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Input
        id={`${idPrefijo}-nombre`}
        label="Nombre"
        value={valores.nombre ?? ''}
        onChange={(e) => onChange({ ...valores, nombre: e.target.value })}
        required
        className="w-48"
      />
      {esPromocion ? (
        <>
          <Input
            id={`${idPrefijo}-cantidadRequerida`}
            label="Lleva (unidades)"
            type="number"
            min="1"
            value={valores.cantidadRequerida ?? ''}
            onChange={(e) => onChange({ ...valores, cantidadRequerida: e.target.value })}
            required
            className="w-32"
          />
          <Input
            id={`${idPrefijo}-cantidadGratis`}
            label="Paga menos (unidades gratis)"
            type="number"
            min="1"
            value={valores.cantidadGratis ?? ''}
            onChange={(e) => onChange({ ...valores, cantidadGratis: e.target.value })}
            required
            className="w-32"
          />
        </>
      ) : (
        <>
          <Select
            id={`${idPrefijo}-tipo`}
            label="Tipo"
            value={valores.tipo ?? 'PORCENTAJE'}
            onChange={(e) => onChange({ ...valores, tipo: e.target.value })}
            className="w-36"
          >
            {TIPOS_DESCUENTO.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
          <Input
            id={`${idPrefijo}-valor`}
            label={valores.tipo === 'MONTO_FIJO' ? 'Monto' : 'Porcentaje'}
            type="number"
            step="0.01"
            min="0"
            value={valores.valor ?? ''}
            onChange={(e) => onChange({ ...valores, valor: e.target.value })}
            required
            className="w-28"
          />
        </>
      )}
      <Select
        id={`${idPrefijo}-alcance`}
        label="Alcance"
        value={valores.alcance ?? (esPromocion ? 'ARTICULO' : 'TODOS')}
        onChange={(e) => onChange({ ...valores, alcance: e.target.value, categoriaId: '', articuloId: '' })}
        className="w-40"
      >
        {!esPromocion && <option value="TODOS">Todos los artículos</option>}
        <option value="CATEGORIA">Una categoría</option>
        <option value="ARTICULO">Un artículo</option>
      </Select>
      {valores.alcance === 'CATEGORIA' && (
        <Select
          id={`${idPrefijo}-categoriaId`}
          label="Categoría"
          value={valores.categoriaId ?? ''}
          onChange={(e) => onChange({ ...valores, categoriaId: e.target.value })}
          required
          className="w-44"
        >
          <option value="">Selecciona una categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </Select>
      )}
      {valores.alcance === 'ARTICULO' && (
        <Select
          id={`${idPrefijo}-articuloId`}
          label="Artículo"
          value={valores.articuloId ?? ''}
          onChange={(e) => onChange({ ...valores, articuloId: e.target.value })}
          required
          className="w-44"
        >
          <option value="">Selecciona un artículo</option>
          {articulos.map((a) => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </Select>
      )}
      <Input
        id={`${idPrefijo}-vigenciaDesde`}
        label="Vigente desde"
        type="date"
        value={valores.vigenciaDesde ?? ''}
        onChange={(e) => onChange({ ...valores, vigenciaDesde: e.target.value })}
        className="w-40"
      />
      <Input
        id={`${idPrefijo}-vigenciaHasta`}
        label="Vigente hasta"
        type="date"
        value={valores.vigenciaHasta ?? ''}
        onChange={(e) => onChange({ ...valores, vigenciaHasta: e.target.value })}
        className="w-40"
      />
      <label className="flex items-center gap-2 pb-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={Boolean(valores.requiereAprobacion)}
          onChange={(e) => onChange({ ...valores, requiereAprobacion: e.target.checked })}
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        Requiere aprobación de Supervisor
      </label>
      {'activo' in valores && (
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={Boolean(valores.activo)}
            onChange={(e) => onChange({ ...valores, activo: e.target.checked })}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Activo
        </label>
      )}
    </div>
  );
}

function SeccionDescuentosPromociones({ esPromocion }) {
  const { permisos } = useAuth();
  const puedeGestionar = permisos?.includes('catalogo.descuentos.gestionar');

  const [items, setItems] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [form, setForm] = useState(() => valoresInicialesFormulario(esPromocion));
  const [error, setError] = useState('');

  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [errorEdit, setErrorEdit] = useState('');

  const listar = esPromocion ? listarPromociones : listarDescuentos;
  const crear = esPromocion ? crearPromocion : crearDescuento;
  const actualizar = esPromocion ? actualizarPromocion : actualizarDescuento;
  const titulo = esPromocion ? 'Promociones' : 'Descuentos';

  function recargar() {
    listar().then(setItems).catch(() => {});
  }

  useEffect(() => {
    recargar();
    listarCategorias().then(setCategorias).catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      await crear(limpiarPayload(form));
      setForm(valoresInicialesFormulario(esPromocion));
      recargar();
    } catch (err) {
      setError(err.response?.data?.error || `No se pudo crear ${esPromocion ? 'la promoción' : 'el descuento'}.`);
    }
  }

  function iniciarEdicion(item) {
    setErrorEdit('');
    setEditandoId(item.id);
    setEditForm({
      ...item,
      valor: item.valor ?? '',
      vigenciaDesde: item.vigenciaDesde ? item.vigenciaDesde.slice(0, 10) : '',
      vigenciaHasta: item.vigenciaHasta ? item.vigenciaHasta.slice(0, 10) : '',
    });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setErrorEdit('');
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    setErrorEdit('');
    try {
      await actualizar(editandoId, limpiarPayload(editForm, ['categoriaId', 'articuloId', 'vigenciaDesde', 'vigenciaHasta']));
      setEditandoId(null);
      recargar();
    } catch (err) {
      setErrorEdit(err.response?.data?.error || `No se pudo actualizar ${esPromocion ? 'la promoción' : 'el descuento'}.`);
    }
  }

  return (
    <Card title={titulo}>
      {esPromocion && (
        <p className="mb-4 text-sm text-gray-500">
          Regla tipo &quot;2x1&quot;: el cajero elige la promoción en el carrito y, si el artículo
          alcanza la cantidad requerida, descuenta el equivalente a las unidades gratis.
        </p>
      )}
      <ul className="divide-y divide-gray-100">
        {items.map((item) => (
          <li key={item.id} className="py-2.5">
            {editandoId === item.id ? (
              <form onSubmit={guardarEdicion} className="flex flex-col gap-3">
                <FormularioDescuentoPromocion
                  valores={editForm}
                  onChange={setEditForm}
                  categorias={categorias}
                  articulos={articulos}
                  esPromocion={esPromocion}
                  idPrefijo={`${titulo}-edit-${item.id}`}
                />
                <div className="flex items-center gap-3">
                  <Button type="submit" variant="secondary">Guardar</Button>
                  <Button type="button" variant="ghost" onClick={cancelarEdicion}>Cancelar</Button>
                </div>
                {errorEdit && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{errorEdit}</p>}
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-gray-700">
                  <span className="font-medium">{item.nombre}</span>
                  {' — '}
                  {esPromocion
                    ? `Lleva ${item.cantidadRequerida}, paga ${item.cantidadRequerida - item.cantidadGratis}`
                    : item.tipo === 'PORCENTAJE' ? `${Number(item.valor)}%` : `$${Number(item.valor).toFixed(2)}`}
                  {' · '}
                  {describirAlcance(item, categorias, articulos)}
                  {item.requiereAprobacion && <Badge tono="warning">requiere aprobación</Badge>}
                  {!item.activo && <Badge tono="gray">inactivo</Badge>}
                </div>
                {puedeGestionar && (
                  <button type="button" onClick={() => iniciarEdicion(item)} className="shrink-0 text-sm text-primary-600 hover:underline">
                    Editar
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="py-2.5 text-sm text-gray-500">Todavía no hay {titulo.toLowerCase()}.</li>}
      </ul>
      {puedeGestionar && (
        <form onSubmit={agregar} className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4">
          <FormularioDescuentoPromocion
            valores={form}
            onChange={setForm}
            categorias={categorias}
            articulos={articulos}
            esPromocion={esPromocion}
            idPrefijo={`${titulo}-nuevo`}
          />
          <div>
            <Button type="submit" variant="secondary">Agregar</Button>
          </div>
          {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
        </form>
      )}
    </Card>
  );
}

function ConfiguracionCatalogoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración de catálogo</h1>
        <p className="text-sm text-gray-500">
          Categorías, marcas, unidades, impuestos, listas de precio, descuentos y promociones.
        </p>
      </div>
      <SeccionCategorias />
      <SeccionSimple
        titulo="Marcas"
        cargar={listarMarcas}
        crear={crearMarca}
        actualizar={actualizarMarca}
        campos={[{ nombre: 'nombre', label: 'Nombre', requerido: true }]}
        renderItem={(m) => m.nombre}
      />
      <SeccionSimple
        titulo="Unidades"
        cargar={listarUnidades}
        crear={crearUnidad}
        actualizar={actualizarUnidad}
        campos={[
          { nombre: 'nombre', label: 'Nombre', requerido: true },
          { nombre: 'abreviatura', label: 'Abreviatura' },
        ]}
        renderItem={(u) => `${u.nombre}${u.abreviatura ? ` (${u.abreviatura})` : ''}`}
      />
      <SeccionSimple
        titulo="Impuestos"
        cargar={listarImpuestos}
        crear={(datos) => crearImpuesto({ ...datos, tasa: Number(datos.tasa) })}
        actualizar={(id, datos) => actualizarImpuesto(id, { ...datos, tasa: Number(datos.tasa) })}
        campos={[
          { nombre: 'nombre', label: 'Nombre', requerido: true },
          { nombre: 'tasa', label: 'Tasa (ej. 0.16)', tipo: 'number', requerido: true },
        ]}
        renderItem={(i) => `${i.nombre} — ${(Number(i.tasa) * 100).toFixed(0)}%`}
      />
      <SeccionListasPrecio />
      <SeccionDescuentosPromociones esPromocion={false} />
      <SeccionDescuentosPromociones esPromocion />
    </div>
  );
}

export default ConfiguracionCatalogoPage;
