import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarProveedores, crearProveedor, actualizarProveedor } from '../api/proveedores.api';

const FORM_VACIO = { nombre: '', telefono: '', correo: '', rfc: '', direccion: '' };

function proveedorAForm(p) {
  return {
    nombre: p.nombre,
    telefono: p.telefono || '',
    correo: p.correo || '',
    rfc: p.rfc || '',
    direccion: p.direccion || '',
    activo: p.activo,
  };
}

function ProveedoresPage() {
  const [proveedores, setProveedores] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');

  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState(FORM_VACIO);
  const [errorEdit, setErrorEdit] = useState('');

  function cargar(filtro) {
    listarProveedores(filtro ? { buscar: filtro } : {}).then(setProveedores).catch(() => {});
  }

  useEffect(() => {
    cargar();
  }, []);

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      await crearProveedor({
        nombre: form.nombre,
        telefono: form.telefono || undefined,
        correo: form.correo || undefined,
        rfc: form.rfc || undefined,
        direccion: form.direccion || undefined,
      });
      setForm(FORM_VACIO);
      cargar(buscar);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el proveedor.');
    }
  }

  function iniciarEdicion(proveedor) {
    setErrorEdit('');
    setEditandoId(proveedor.id);
    setEditForm(proveedorAForm(proveedor));
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setErrorEdit('');
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    setErrorEdit('');
    try {
      await actualizarProveedor(editandoId, {
        nombre: editForm.nombre,
        telefono: editForm.telefono || undefined,
        correo: editForm.correo || undefined,
        rfc: editForm.rfc || undefined,
        direccion: editForm.direccion || undefined,
        activo: editForm.activo,
      });
      setEditandoId(null);
      cargar(buscar);
    } catch (err) {
      setErrorEdit(err.response?.data?.error || 'No se pudo actualizar el proveedor.');
    }
  }

  function buscarSubmit(e) {
    e.preventDefault();
    cargar(buscar);
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 600 }}>
      <p><Link to="/dashboard">← Volver al dashboard</Link></p>
      <h1>Proveedores</h1>

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
            <th />
          </tr>
        </thead>
        <tbody>
          {proveedores.map((p) => (
            <Fragment key={p.id}>
              <tr>
                <td>{p.nombre}</td>
                <td>{p.telefono || '—'}</td>
                <td>{p.correo || '—'}</td>
                <td>{p.activo ? 'Sí' : 'No'}</td>
                <td>
                  {editandoId === p.id
                    ? <button type="button" onClick={cancelarEdicion}>Cerrar</button>
                    : <button type="button" onClick={() => iniciarEdicion(p)}>Editar</button>}
                </td>
              </tr>
              {editandoId === p.id && (
                <tr>
                  <td colSpan={5} style={{ background: '#f7f7f7', padding: '1rem' }}>
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
                        <input
                          type="checkbox"
                          checked={editForm.activo}
                          onChange={(e) => setEditForm((f) => ({ ...f, activo: e.target.checked }))}
                        /> Activo (desmarca para dejar de poder registrarle compras)
                      </label>
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

      <h2>Nuevo proveedor</h2>
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
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit">Crear proveedor</button>
      </form>
    </div>
  );
}

export default ProveedoresPage;
