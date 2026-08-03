import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarArticulos,
  crearArticulo,
  listarCategorias,
  listarMarcas,
  listarUnidades,
  listarImpuestos,
  listarListasPrecio,
  actualizarPreciosArticulo,
} from '../api/catalogo.api';

const FORM_VACIO = {
  tipo: 'PRODUCTO',
  nombre: '',
  sku: '',
  unidadBaseId: '',
  categoriaId: '',
  marcaId: '',
  impuestoId: '',
  costo: '',
  precio: '',
};

function ArticulosPage() {
  const [articulos, setArticulos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [impuestos, setImpuestos] = useState([]);
  const [listasPrecio, setListasPrecio] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');

  const [preciosArticuloId, setPreciosArticuloId] = useState(null);
  const [preciosForm, setPreciosForm] = useState({});
  const [preciosError, setPreciosError] = useState('');

  function cargarArticulos(filtro) {
    listarArticulos(filtro ? { buscar: filtro } : {}).then(setArticulos).catch(() => {});
  }

  useEffect(() => {
    cargarArticulos();
    listarCategorias().then(setCategorias).catch(() => {});
    listarMarcas().then(setMarcas).catch(() => {});
    listarUnidades().then(setUnidades).catch(() => {});
    listarImpuestos().then(setImpuestos).catch(() => {});
    listarListasPrecio().then(setListasPrecio).catch(() => {});
  }, []);

  function abrirPrecios(articulo) {
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
      cargarArticulos(buscar);
    } catch (err) {
      setPreciosError(err.response?.data?.error || 'No se pudieron guardar los precios.');
    }
  }

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      await crearArticulo({
        tipo: form.tipo,
        nombre: form.nombre,
        sku: form.sku || undefined,
        unidadBaseId: form.unidadBaseId,
        categoriaId: form.categoriaId || undefined,
        marcaId: form.marcaId || undefined,
        impuestoId: form.impuestoId || undefined,
        costo: form.costo ? Number(form.costo) : undefined,
        precio: form.precio ? Number(form.precio) : undefined,
      });
      setForm(FORM_VACIO);
      cargarArticulos(buscar);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el artículo.');
    }
  }

  function buscarSubmit(e) {
    e.preventDefault();
    cargarArticulos(buscar);
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 700 }}>
      <p><Link to="/dashboard">← Volver al dashboard</Link></p>
      <h1>Artículos y servicios</h1>

      {unidades.length === 0 && (
        <p>
          Primero crea al menos una <Link to="/catalogo/configuracion">unidad</Link> para poder dar de alta artículos.
        </p>
      )}

      <form onSubmit={buscarSubmit} style={{ marginBottom: '1rem' }}>
        <input
          placeholder="Buscar por nombre, SKU o código"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <button type="submit">Buscar</button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Nombre</th>
            <th style={{ textAlign: 'left' }}>SKU</th>
            <th style={{ textAlign: 'left' }}>Precio</th>
            <th style={{ textAlign: 'left' }}>Activo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {articulos.map((a) => (
            <Fragment key={a.id}>
              <tr>
                <td>{a.nombre}</td>
                <td>{a.sku || '—'}</td>
                <td>{a.precio}</td>
                <td>{a.activo ? 'Sí' : 'No'}</td>
                <td>
                  {listasPrecio.length > 0 && (
                    preciosArticuloId === a.id
                      ? <button type="button" onClick={cerrarPrecios}>Cerrar</button>
                      : <button type="button" onClick={() => abrirPrecios(a)}>Precios</button>
                  )}
                </td>
              </tr>
              {preciosArticuloId === a.id && (
                <tr>
                  <td colSpan={5} style={{ background: '#f7f7f7', padding: '1rem' }}>
                    <form
                      onSubmit={guardarPrecios}
                      style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 320 }}
                    >
                      {listasPrecio.map((l) => (
                        <label key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                          {l.nombre}
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={`base: ${a.precio}`}
                            value={preciosForm[l.id] ?? ''}
                            onChange={(e) => setPreciosForm((f) => ({ ...f, [l.id]: e.target.value }))}
                            style={{ width: '120px' }}
                          />
                        </label>
                      ))}
                      {preciosError && <p style={{ color: 'crimson' }}>{preciosError}</p>}
                      <button type="submit">Guardar precios</button>
                    </form>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>

      <h2>Nuevo artículo</h2>
      <form onSubmit={agregar} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 360 }}>
        <label>
          Tipo
          <select value={form.tipo} onChange={(e) => actualizarCampo('tipo', e.target.value)}>
            <option value="PRODUCTO">Producto</option>
            <option value="SERVICIO">Servicio</option>
          </select>
        </label>
        <label>
          Nombre
          <input value={form.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
        </label>
        <label>
          SKU
          <input value={form.sku} onChange={(e) => actualizarCampo('sku', e.target.value)} />
        </label>
        <label>
          Unidad base
          <select
            value={form.unidadBaseId}
            onChange={(e) => actualizarCampo('unidadBaseId', e.target.value)}
            required
          >
            <option value="">Selecciona...</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>
        </label>
        <label>
          Categoría
          <select value={form.categoriaId} onChange={(e) => actualizarCampo('categoriaId', e.target.value)}>
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
        <label>
          Marca
          <select value={form.marcaId} onChange={(e) => actualizarCampo('marcaId', e.target.value)}>
            <option value="">Sin marca</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        </label>
        <label>
          Impuesto
          <select value={form.impuestoId} onChange={(e) => actualizarCampo('impuestoId', e.target.value)}>
            <option value="">Sin impuesto</option>
            {impuestos.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre}</option>
            ))}
          </select>
        </label>
        <label>
          Costo
          <input type="number" step="0.01" value={form.costo} onChange={(e) => actualizarCampo('costo', e.target.value)} />
        </label>
        <label>
          Precio
          <input
            type="number"
            step="0.01"
            value={form.precio}
            onChange={(e) => actualizarCampo('precio', e.target.value)}
          />
        </label>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit">Crear artículo</button>
      </form>
    </div>
  );
}

export default ArticulosPage;
