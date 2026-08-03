import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarSucursales, crearSucursal, actualizarSucursal } from '../api/core.api';

const FORM_VACIO = { nombre: '', clave: '', telefono: '', correo: '', direccion: '', responsable: '' };
const EDIT_VACIO = { nombre: '', telefono: '', correo: '', direccion: '', responsable: '', estado: 'ACTIVA' };

function SucursalesPage() {
  const [sucursales, setSucursales] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState(EDIT_VACIO);
  const [errorEdit, setErrorEdit] = useState('');

  function cargar() {
    listarSucursales().then(setSucursales).catch(() => {});
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
      await crearSucursal({
        nombre: form.nombre,
        clave: form.clave,
        telefono: form.telefono || undefined,
        correo: form.correo || undefined,
        direccion: form.direccion || undefined,
        responsable: form.responsable || undefined,
      });
      setForm(FORM_VACIO);
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la sucursal.');
    }
  }

  function iniciarEdicion(sucursal) {
    setEditandoId(sucursal.id);
    setErrorEdit('');
    setEditForm({
      nombre: sucursal.nombre || '',
      telefono: sucursal.telefono || '',
      correo: sucursal.correo || '',
      direccion: sucursal.direccion || '',
      responsable: sucursal.responsable || '',
      estado: sucursal.estado,
    });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setErrorEdit('');
  }

  async function guardarEdicion(id) {
    setErrorEdit('');
    try {
      await actualizarSucursal(id, {
        nombre: editForm.nombre,
        // telefono/direccion/responsable son texto libre: un valor vacío es válido y debe
        // poder borrar lo que ya había. correo sí necesita omitirse si está vacío porque el
        // backend lo valida como email y "" no pasa esa validación.
        telefono: editForm.telefono,
        correo: editForm.correo || undefined,
        direccion: editForm.direccion,
        responsable: editForm.responsable,
        estado: editForm.estado,
      });
      setEditandoId(null);
      cargar();
    } catch (err) {
      setErrorEdit(err.response?.data?.error || 'No se pudo actualizar la sucursal.');
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 800 }}>
      <p><Link to="/dashboard">← Volver al dashboard</Link></p>
      <h1>Sucursales</h1>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Nombre</th>
            <th style={{ textAlign: 'left' }}>Clave</th>
            <th style={{ textAlign: 'left' }}>Teléfono</th>
            <th style={{ textAlign: 'left' }}>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sucursales.map((s) => (
            <tr key={s.id}>
              {editandoId === s.id ? (
                <>
                  <td>
                    <input
                      value={editForm.nombre}
                      onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                      required
                    />
                  </td>
                  <td>{s.clave}</td>
                  <td>
                    <input
                      value={editForm.telefono}
                      onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))}
                    />
                  </td>
                  <td>
                    <select
                      value={editForm.estado}
                      onChange={(e) => setEditForm((f) => ({ ...f, estado: e.target.value }))}
                    >
                      <option value="ACTIVA">Activa</option>
                      <option value="SUSPENDIDA">Suspendida</option>
                      <option value="ARCHIVADA">Archivada</option>
                    </select>
                  </td>
                  <td>
                    <button type="button" onClick={() => guardarEdicion(s.id)}>Guardar</button>{' '}
                    <button type="button" onClick={cancelarEdicion}>Cancelar</button>
                  </td>
                </>
              ) : (
                <>
                  <td>{s.nombre}</td>
                  <td>{s.clave}</td>
                  <td>{s.telefono || '—'}</td>
                  <td>{s.estado}</td>
                  <td><button type="button" onClick={() => iniciarEdicion(s)}>Editar</button></td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {errorEdit && <p style={{ color: 'crimson' }}>{errorEdit}</p>}

      <h2>Nueva sucursal</h2>
      <form onSubmit={agregar} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 320 }}>
        <label>
          Nombre
          <input value={form.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
        </label>
        <label>
          Clave
          <input value={form.clave} onChange={(e) => actualizarCampo('clave', e.target.value)} required />
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
          Dirección
          <input value={form.direccion} onChange={(e) => actualizarCampo('direccion', e.target.value)} />
        </label>
        <label>
          Responsable
          <input value={form.responsable} onChange={(e) => actualizarCampo('responsable', e.target.value)} />
        </label>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit">Crear sucursal</button>
      </form>
    </div>
  );
}

export default SucursalesPage;
