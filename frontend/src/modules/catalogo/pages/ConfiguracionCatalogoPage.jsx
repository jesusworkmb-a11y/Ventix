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
    <div style={{ marginBottom: '2rem' }}>
      <h3>Categorías</h3>
      <ul>
        {categorias.map((c) => (
          <li key={c.id} style={{ marginBottom: '0.5rem' }}>
            {editandoId === c.id ? (
              <form
                onSubmit={guardarEdicion}
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}
              >
                <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} required />
                <select value={editPadreId} onChange={(e) => setEditPadreId(e.target.value)}>
                  <option value="">Sin categoría padre</option>
                  {padresPosibles.filter((p) => p.id !== c.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
                <button type="submit">Guardar</button>
                <button type="button" onClick={cancelarEdicion}>Cancelar</button>
                {errorEdit && <p style={{ color: 'crimson', width: '100%', margin: 0 }}>{errorEdit}</p>}
              </form>
            ) : (
              <>
                {c.nombre}
                {c.categoriaPadreId ? ' (subcategoría)' : ''}{' '}
                <button type="button" onClick={() => iniciarEdicion(c)}>Editar</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={agregar} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <select value={padreId} onChange={(e) => setPadreId(e.target.value)}>
          <option value="">Sin categoría padre</option>
          {padresPosibles.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <button type="submit">Agregar</button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
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
    <div style={{ marginBottom: '2rem' }}>
      <h3>{titulo}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.id} style={{ marginBottom: '0.5rem' }}>
            {editandoId === item.id ? (
              <form
                onSubmit={guardarEdicion}
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}
              >
                {campos.map((campo) => (
                  <input
                    key={campo.nombre}
                    type={campo.tipo || 'text'}
                    step={campo.tipo === 'number' ? '0.01' : undefined}
                    placeholder={campo.label}
                    value={editForm[campo.nombre] ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, [campo.nombre]: e.target.value }))}
                    required={campo.requerido}
                  />
                ))}
                <button type="submit">Guardar</button>
                <button type="button" onClick={cancelarEdicion}>Cancelar</button>
                {errorEdit && <p style={{ color: 'crimson', width: '100%', margin: 0 }}>{errorEdit}</p>}
              </form>
            ) : (
              <>
                {renderItem(item)}
                {actualizar && (
                  <>{' '}<button type="button" onClick={() => iniciarEdicion(item)}>Editar</button></>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={agregar} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {campos.map((campo) => (
          <input
            key={campo.nombre}
            type={campo.tipo || 'text'}
            step={campo.tipo === 'number' ? '0.01' : undefined}
            placeholder={campo.label}
            value={form[campo.nombre] || ''}
            onChange={(e) => setForm((f) => ({ ...f, [campo.nombre]: e.target.value }))}
            required={campo.requerido}
          />
        ))}
        <button type="submit">Agregar</button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
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
    <div style={{ marginBottom: '2rem' }}>
      <h3>Listas de precio</h3>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        Asigna precios por artículo a cada lista en <em>Artículos</em>, y una lista a cada cliente en{' '}
        <em>Clientes</em> — al vender, se cobra el precio de la lista del cliente si existe uno definido
        ahí para ese artículo; si no, el precio base del catálogo.
      </p>
      <ul>
        {listas.map((l) => (
          <li key={l.id}>{l.nombre}{l.esBase ? ' (base)' : ''}</li>
        ))}
      </ul>
      <form onSubmit={agregar} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Nombre (ej. Mayoreo)" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <label>
          <input type="checkbox" checked={esBase} onChange={(e) => setEsBase(e.target.checked)} /> Es base
        </label>
        <button type="submit">Agregar</button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  );
}

function ConfiguracionCatalogoPage() {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 600 }}>
      <h1>Configuración de catálogo</h1>
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
