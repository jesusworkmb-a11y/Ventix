import { useEffect, useState } from 'react';
import { listarRoles, crearRol, actualizarRol, reemplazarPermisosRol, listarPermisos } from '../api/core.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Modal from '../../../shared/ui/Modal';

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
  const rolEnEdicion = roles.find((r) => r.id === editandoPermisosId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Roles y permisos</h1>
        <p className="text-sm text-gray-500">Definí qué puede hacer cada rol dentro del sistema.</p>
      </div>

      <div className="space-y-4">
        {roles.map((rol) => (
          <Card key={rol.id}>
            {renombrandoId === rol.id ? (
              <div className="mb-2 flex flex-wrap items-end gap-3">
                <Input id={`renombrarRol-${rol.id}`} value={renombrarValor} onChange={(e) => setRenombrarValor(e.target.value)} required className="w-56" />
                <Button variant="secondary" onClick={() => guardarRenombrar(rol.id)}>Guardar</Button>
                <Button variant="ghost" onClick={() => setRenombrandoId(null)}>Cancelar</Button>
              </div>
            ) : (
              <div className="mb-2 flex items-center gap-3">
                <h3 className="text-base font-semibold text-gray-900">{rol.nombre}</h3>
                <button type="button" onClick={() => iniciarRenombrar(rol)} className="text-sm text-primary-600 hover:underline">
                  Renombrar
                </button>
              </div>
            )}
            {renombrandoId === rol.id && errorRenombrar && (
              <p className="mb-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{errorRenombrar}</p>
            )}

            <p className="mb-3 text-sm text-gray-500">{rol.permisos.length} permiso(s) asignado(s)</p>

            <Button variant="secondary" onClick={() => iniciarEdicionPermisos(rol)}>Editar permisos</Button>
          </Card>
        ))}
      </div>

      <Card title="Nuevo rol">
        <form onSubmit={agregar} className="flex flex-wrap items-end gap-3">
          <Input id="nombreRolNuevo" label="Nombre del rol" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} required className="w-56" />
          <Button type="submit">Crear rol</Button>
        </form>
        {error && <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
      </Card>

      <Modal
        abierto={editandoPermisosId !== null}
        onCerrar={() => setEditandoPermisosId(null)}
        titulo={`Permisos de ${rolEnEdicion?.nombre || ''}`}
        ancho="max-w-2xl"
      >
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {gruposPermisos.map(([grupo, permisos]) => (
            <div key={grupo}>
              <p className="mb-2 text-sm font-semibold text-gray-800">{grupo}</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {permisos.map((p) => (
                  <label key={p.clave} className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={permisosSeleccionados.has(p.clave)}
                      onChange={() => alternarPermiso(p.clave)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    {p.nombre}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {errorPermisos && <p className="mt-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{errorPermisos}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditandoPermisosId(null)}>Cancelar</Button>
          <Button onClick={() => guardarPermisos(editandoPermisosId)}>Guardar permisos</Button>
        </div>
      </Modal>
    </div>
  );
}

export default RolesPage;
