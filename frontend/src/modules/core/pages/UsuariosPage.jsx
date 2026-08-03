import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarUsuarios, crearUsuario, actualizarUsuario, listarRoles } from '../api/core.api';

const FORM_VACIO = { nombre: '', correo: '', password: '', rolId: '' };
const EDIT_VACIO = { rolId: '', estado: 'ACTIVO', telefono: '' };

function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState(EDIT_VACIO);
  const [errorEdit, setErrorEdit] = useState('');

  function cargar() {
    listarUsuarios().then(setUsuarios).catch(() => {});
  }

  useEffect(() => {
    cargar();
    listarRoles().then(setRoles).catch(() => {});
  }, []);

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      await crearUsuario({
        nombre: form.nombre,
        correo: form.correo,
        password: form.password,
        rolId: form.rolId,
      });
      setForm(FORM_VACIO);
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el usuario.');
    }
  }

  function iniciarEdicion(usuario) {
    setEditandoId(usuario.id);
    setErrorEdit('');
    setEditForm({
      rolId: usuario.rol?.id || '',
      estado: usuario.estado,
      telefono: usuario.telefono || '',
    });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setErrorEdit('');
  }

  async function guardarEdicion(id) {
    setErrorEdit('');
    try {
      await actualizarUsuario(id, {
        rolId: editForm.rolId,
        estado: editForm.estado,
        telefono: editForm.telefono,
      });
      setEditandoId(null);
      cargar();
    } catch (err) {
      setErrorEdit(err.response?.data?.error || 'No se pudo actualizar el usuario.');
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 800 }}>
      <p><Link to="/dashboard">← Volver al dashboard</Link></p>
      <h1>Usuarios</h1>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Nombre</th>
            <th style={{ textAlign: 'left' }}>Correo</th>
            <th style={{ textAlign: 'left' }}>Rol</th>
            <th style={{ textAlign: 'left' }}>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id}>
              {editandoId === u.id ? (
                <>
                  <td>{u.nombre}</td>
                  <td>{u.correo}</td>
                  <td>
                    <select
                      value={editForm.rolId}
                      onChange={(e) => setEditForm((f) => ({ ...f, rolId: e.target.value }))}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.nombre}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={editForm.estado}
                      onChange={(e) => setEditForm((f) => ({ ...f, estado: e.target.value }))}
                    >
                      <option value="ACTIVO">Activo</option>
                      <option value="INACTIVO">Inactivo</option>
                      <option value="BLOQUEADO">Bloqueado</option>
                    </select>
                  </td>
                  <td>
                    <button type="button" onClick={() => guardarEdicion(u.id)}>Guardar</button>{' '}
                    <button type="button" onClick={cancelarEdicion}>Cancelar</button>
                  </td>
                </>
              ) : (
                <>
                  <td>{u.nombre}</td>
                  <td>{u.correo}</td>
                  <td>{u.rol?.nombre || '—'}</td>
                  <td>{u.estado}</td>
                  <td><button type="button" onClick={() => iniciarEdicion(u)}>Editar</button></td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {errorEdit && <p style={{ color: 'crimson' }}>{errorEdit}</p>}

      <h2>Nuevo usuario</h2>
      {roles.length === 0 && <p>Cargando roles disponibles...</p>}
      <form onSubmit={agregar} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 320 }}>
        <label>
          Nombre
          <input value={form.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
        </label>
        <label>
          Correo
          <input type="email" value={form.correo} onChange={(e) => actualizarCampo('correo', e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => actualizarCampo('password', e.target.value)}
            required
          />
        </label>
        <label>
          Rol
          <select value={form.rolId} onChange={(e) => actualizarCampo('rolId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </label>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit">Crear usuario</button>
      </form>
    </div>
  );
}

export default UsuariosPage;
