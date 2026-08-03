import { useEffect, useState } from 'react';
import {
  listarCategorias,
  crearCategoria,
  listarMarcas,
  crearMarca,
  listarUnidades,
  crearUnidad,
  listarImpuestos,
  crearImpuesto,
  listarListasPrecio,
  crearListaPrecio,
} from '../api/catalogo.api';

// Categorías tiene lógica propia (padre + límite de 2 niveles), por eso no usa SeccionSimple.
function SeccionCategorias() {
  const [categorias, setCategorias] = useState([]);
  const [nombre, setNombre] = useState('');
  const [padreId, setPadreId] = useState('');
  const [error, setError] = useState('');

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

  const padresPosibles = categorias.filter((c) => !c.categoriaPadreId);

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3>Categorías</h3>
      <ul>
        {categorias.map((c) => (
          <li key={c.id}>
            {c.nombre}
            {c.categoriaPadreId ? ' (subcategoría)' : ''}
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
// el mismo bloque 3 veces con la única diferencia siendo los campos del formulario.
function SeccionSimple({ titulo, cargar, crear, campos, renderItem }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

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

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3>{titulo}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{renderItem(item)}</li>
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
        campos={[{ nombre: 'nombre', label: 'Nombre', requerido: true }]}
        renderItem={(m) => m.nombre}
      />
      <SeccionSimple
        titulo="Unidades"
        cargar={listarUnidades}
        crear={crearUnidad}
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
