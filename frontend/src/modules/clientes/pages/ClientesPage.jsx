import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarClientes, crearCliente, actualizarCliente } from '../api/clientes.api';
import { listarListasPrecio } from '../../catalogo/api/catalogo.api';

const FORM_VACIO = { nombre: '', telefono: '', correo: '', rfc: '', direccion: '', listaPrecioId: '' };

function clienteAForm(c) {
  return {
    nombre: c.nombre,
    telefono: c.telefono || '',
    correo: c.correo || '',
    rfc: c.rfc || '',
    direccion: c.direccion || '',
    listaPrecioId: c.listaPrecioId || '',
    activo: c.activo,
  };
}

function ClientesPage() {
  const [clientes, setClientes] = useState([]);
  const [listasPrecio, setListasPrecio] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');

  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState(FORM_VACIO);
  const [errorEdit, setErrorEdit] = useState('');

  function cargar(filtro) {
    listarClientes(filtro ? { buscar: filtro } : {}).then(setClientes).catch(() => {});
  }

  useEffect(() => {
    cargar();
    listarListasPrecio().then(setListasPrecio).catch(() => {});
  }, []);

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      await crearCliente({
        nombre: form.nombre,
        telefono: form.telefono || undefined,
        correo: form.correo || undefined,
        rfc: form.rfc || undefined,
        direccion: form.direccion || undefined,
        listaPrecioId: form.listaPrecioId || undefined,
      });
      setForm(FORM_VACIO);
      cargar(buscar);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el cliente.');
    }
  }

  async function cambiarListaPrecio(cliente, listaPrecioId) {
    setError('');
    try {
      await actualizarCliente(cliente.id, { listaPrecioId: listaPrecioId || null });
      cargar(buscar);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo asignar la lista de precio.');
    }
  }

  function iniciarEdicion(cliente) {
    setErrorEdit('');
    setEditandoId(cliente.id);
    setEditForm(clienteAForm(cliente));
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setErrorEdit('');
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    setErrorEdit('');
    try {
      await actualizarCliente(editandoId, {
        nombre: editForm.nombre,
        telefono: editForm.telefono || undefined,
        correo: editForm.correo || undefined,
        rfc: editForm.rfc || undefined,
        direccion: editForm.direccion || undefined,
        listaPrecioId: editForm.listaPrecioId || null,
        activo: editForm.activo,
      });
      setEditandoId(null);
      cargar(buscar);
    } catch (err) {
      setErrorEdit(err.response?.data?.error || 'No se pudo actualizar el cliente.');
    }
  }

  function buscarSubmit(e) {
    e.preventDefault();
    cargar(buscar);
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 600 }}>
      <p><Link to="/dashboard">← Volver al dashboard</Link></p>
      <h1>Clientes</h1>

      <form onSubmit={buscarSubmit} style={{ marginBottom: '1rem' }}>
        <input
          placeholder="Buscar por nombre, correo, teléfono o RFC"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <button type="submit">Buscar</button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Nombre</th>
            <th style={{ textAlign: 'left' }}>Teléfono</th>
            <th style={{ textAlign: 'left' }}>Correo</th>
            <th style={{ textAlign: 'left' }}>Activo</th>
            <th style={{ textAlign: 'left' }}>Lista de precio</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <Fragment key={c.id}>
              <tr>
                <td>{c.nombre}{c.esGeneral ? ' (general)' : ''}</td>
                <td>{c.telefono || '—'}</td>
                <td>{c.correo || '—'}</td>
                <td>{c.activo ? 'Sí' : 'No'}</td>
                <td>
                  {listasPrecio.length > 0 ? (
                    <select
                      value={c.listaPrecioId || ''}
                      onChange={(e) => cambiarListaPrecio(c, e.target.value)}
                    >
                      <option value="">Precio base</option>
                      {listasPrecio.map((l) => (
                        <option key={l.id} value={l.id}>{l.nombre}</option>
                      ))}
                    </select>
                  ) : '—'}
                </td>
                <td>
                  {editandoId === c.id
                    ? <button type="button" onClick={cancelarEdicion}>Cerrar</button>
                    : <button type="button" onClick={() => iniciarEdicion(c)}>Editar</button>}
                </td>
              </tr>
              {editandoId === c.id && (
                <tr>
                  <td colSpan={6} style={{ background: '#f7f7f7', padding: '1rem' }}>
                    <form
                      onSubmit={guardarEdicion}
                      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 320 }}
                    >
                      <label>
                        Nombre
                        <input
                          value={editForm.nombre}
                          onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        Teléfono
                        <input
                          value={editForm.telefono}
                          onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))}
                        />
                      </label>
                      <label>
                        Correo
                        <input
                          type="email"
                          value={editForm.correo}
                          onChange={(e) => setEditForm((f) => ({ ...f, correo: e.target.value }))}
                        />
                      </label>
                      <label>
                        RFC
                        <input
                          value={editForm.rfc}
                          onChange={(e) => setEditForm((f) => ({ ...f, rfc: e.target.value }))}
                        />
                      </label>
                      <label>
                        Dirección
                        <input
                          value={editForm.direccion}
                          onChange={(e) => setEditForm((f) => ({ ...f, direccion: e.target.value }))}
                        />
                      </label>
                      <label>
                        Lista de precio
                        <select
                          value={editForm.listaPrecioId}
                          onChange={(e) => setEditForm((f) => ({ ...f, listaPrecioId: e.target.value }))}
                        >
                          <option value="">Precio base</option>
                          {listasPrecio.map((l) => (
                            <option key={l.id} value={l.id}>{l.nombre}</option>
                          ))}
                        </select>
                      </label>
                      {!c.esGeneral && (
                        <label>
                          <input
                            type="checkbox"
                            checked={editForm.activo}
                            onChange={(e) => setEditForm((f) => ({ ...f, activo: e.target.checked }))}
                          /> Activo (desmarca para dejar de poderle vender)
                        </label>
                      )}
                      {errorEdit && <p style={{ color: 'crimson' }}>{errorEdit}</p>}
                      <button type="submit">Guardar cambios</button>
                    </form>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>

      <h2>Nuevo cliente</h2>
      <form onSubmit={agregar} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 320 }}>
        <label>
          Nombre
          <input value={form.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
        </label>
        <label>
          Teléfono
          <input value={form.telefono} onChange={(e) => actualizarCampo('telefono', e.target.value)} />
        </label>
        <label>
          Correo
          <input type="email" value={form.correo} onChange={(e) => actualizarCampo('correo', e.target.value)} />
        </label>
        <label>
          RFC
          <input value={form.rfc} onChange={(e) => actualizarCampo('rfc', e.target.value)} />
        </label>
        <label>
          Dirección
          <input value={form.direccion} onChange={(e) => actualizarCampo('direccion', e.target.value)} />
        </label>
        <label>
          Lista de precio
          <select
            value={form.listaPrecioId}
            onChange={(e) => actualizarCampo('listaPrecioId', e.target.value)}
          >
            <option value="">Precio base</option>
            {listasPrecio.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
        </label>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit">Crear cliente</button>
      </form>
    </div>
  );
}

export default ClientesPage;
