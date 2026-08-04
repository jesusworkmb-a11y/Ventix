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
} from '../api/catalogo.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';

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

function ConfiguracionCatalogoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración de catálogo</h1>
        <p className="text-sm text-gray-500">Categorías, marcas, unidades, impuestos y listas de precio.</p>
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
    </div>
  );
}

export default ConfiguracionCatalogoPage;
