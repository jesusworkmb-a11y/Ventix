import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarRoles, crearRol, actualizarRol, reemplazarPermisosRol, listarPermisos } from '../api/core.api';

function agruparPorGrupo(permisos) {
  const grupos = new Map();
  for (const p of permisos) {
    if (!grupos.has(p.grupo)) grupos.set(p.grupo, []);
    grupos.get(p.grupo).push(p);
  }
  return [...grupos.entries()];
}

function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [permisosCatalogo, setPermisosCatalogo] = useState([]);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [error, setError] = useState('');

  const [renombrandoId, setRenombrandoId] = useState(null);
  const [renombrarValor, setRenombrarValor] = useState('');
  const [errorRenombrar, setErrorRenombrar] = useState('');

  const [editandoPermisosId, setEditandoPermisosId] = useState(null);
  const [permisosSeleccionados, setPermisosSeleccionados] = useState(new Set());
  const [errorPermisos, setErrorPermisos] = useState('');

  function cargarRoles() {
    listarRoles().then(setRoles).catch(() => {});
  }

  useEffect(() => {
    cargarRoles();
    listarPermisos().then(setPermisosCatalogo).catch(() => {});
  }, []);

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      await crearRol({ nombre: nombreNuevo });
      setNombreNuevo('');
      cargarRoles();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el rol.');
    }
  }

  function iniciarRenombrar(rol) {
    setRenombrandoId(rol.id);
    setRenombrarValor(rol.nombre);
    setErrorRenombrar('');
  }

  async function guardarRenombrar(id) {
    setErrorRenombrar('');
    try {
      await actualizarRol(id, { nombre: renombrarValor });
      setRenombrandoId(null);
      cargarRoles();
    } catch (err) {
      setErrorRenombrar(err.response?.data?.error || 'No se pudo renombrar el rol.');
    }
  }

  function iniciarEdicionPermisos(rol) {
    setEditandoPermisosId(rol.id);
    setPermisosSeleccionados(new Set(rol.permisos));
    setErrorPermisos('');
  }

  function alternarPermiso(clave) {
    setPermisosSeleccionados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }

  async function guardarPermisos(id) {
    setErrorPermisos('');
    try {
      await reemplazarPermisosRol(id, [...permisosSeleccionados]);
      setEditandoPermisosId(null);
      cargarRoles();
    } catch (err) {
      setErrorPermisos(err.response?.data?.error || 'No se pudieron guardar los permisos.');
    }
  }

  const gruposPermisos = agruparPorGrupo(permisosCatalogo);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 800 }}>
      <p><Link to="/dashboard">← Volver al dashboard</Link></p>
      <h1>Roles y permisos</h1>

      {roles.map((rol) => (
        <div key={rol.id} style={{ border: '1px solid #ccc', borderRadius: 4, padding: '1rem', marginBottom: '1rem' }}>
          {renombrandoId === rol.id ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
              <input value={renombrarValor} onChange={(e) => setRenombrarValor(e.target.value)} required />
              <button type="button" onClick={() => guardarRenombrar(rol.id)}>Guardar</button>
              <button type="button" onClick={() => setRenombrandoId(null)}>Cancelar</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>{rol.nombre}</h3>
              <button type="button" onClick={() => iniciarRenombrar(rol)}>Renombrar</button>
            </div>
          )}
          {renombrandoId === rol.id && errorRenombrar && <p style={{ color: 'crimson' }}>{errorRenombrar}</p>}

          <p>{rol.permisos.length} permiso(s) asignado(s)</p>

          {editandoPermisosId === rol.id ? (
            <div>
              {gruposPermisos.map(([grupo, permisos]) => (
                <div key={grupo} style={{ marginBottom: '0.75rem' }}>
                  <strong>{grupo}</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '1rem' }}>
                    {permisos.map((p) => (
                      <label key={p.clave}>
                        <input
                          type="checkbox"
                          checked={permisosSeleccionados.has(p.clave)}
                          onChange={() => alternarPermiso(p.clave)}
                        />{' '}
                        {p.nombre}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {errorPermisos && <p style={{ color: 'crimson' }}>{errorPermisos}</p>}
              <button type="button" onClick={() => guardarPermisos(rol.id)}>Guardar permisos</button>{' '}
              <button type="button" onClick={() => setEditandoPermisosId(null)}>Cancelar</button>
            </div>
          ) : (
            <button type="button" onClick={() => iniciarEdicionPermisos(rol)}>Editar permisos</button>
          )}
        </div>
      ))}

      <h2>Nuevo rol</h2>
      <form onSubmit={agregar} style={{ display: 'flex', gap: '0.5rem', maxWidth: 320 }}>
        <input
          placeholder="Nombre del rol"
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          required
        />
        <button type="submit">Crear rol</button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  );
}

export default RolesPage;
