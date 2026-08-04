import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { listarUsuarios, crearUsuario, actualizarUsuario, listarRoles } from '../api/core.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';
import Paginacion from '../../../shared/ui/Paginacion';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';

const FORM_VACIO = { nombre: '', correo: '', password: '', rolId: '' };
const EDIT_VACIO = { rolId: '', estado: 'ACTIVO', telefono: '' };

const ESTADO_TONO = { ACTIVO: 'success', INACTIVO: 'gray', BLOQUEADO: 'danger' };

const COLUMNAS_USUARIOS = [
  { label: 'Nombre', clave: 'nombre', ordenable: true },
  { label: 'Correo', clave: 'correo', ordenable: true },
  { label: 'Rol', clave: 'rol', ordenable: true },
  { label: 'Estado', clave: 'estado', ordenable: true },
  { label: '', clave: null },
];

function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState(EDIT_VACIO);
  const [errorEdit, setErrorEdit] = useState('');
  const [buscar, setBuscar] = useState('');
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [orden, setOrden] = useState({ ordenarPor: 'nombre', orden: 'asc' });

  function cargar(pagina = 1) {
    listarUsuarios({
      buscar: buscar || undefined,
      pagina,
      porPagina: 20,
      ordenarPor: orden.ordenarPor,
      orden: orden.orden,
    })
      .then((r) => {
        setUsuarios(r.datos);
        setPaginacion({ pagina: r.pagina, totalPaginas: r.totalPaginas, total: r.total });
      })
      .catch(() => {});
  }

  function handleOrdenar(clave) {
    setOrden((o) => (o.ordenarPor === clave
      ? { ordenarPor: clave, orden: o.orden === 'asc' ? 'desc' : 'asc' }
      : { ordenarPor: clave, orden: 'asc' }));
  }

  useEffect(() => {
    listarRoles().then(setRoles).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden]);

  function buscarSubmit(e) {
    e.preventDefault();
    cargar(1);
  }

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
      cargar(1);
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
      cargar(paginacion.pagina);
    } catch (err) {
      setErrorEdit(err.response?.data?.error || 'No se pudo actualizar el usuario.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <p className="text-sm text-gray-500">Cuentas de acceso al sistema y su rol asignado.</p>
      </div>

      <Card>
        <form onSubmit={buscarSubmit} className="flex items-end gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-[38px] text-gray-400" />
            <Input
              id="buscarUsuario"
              label="Buscar"
              placeholder="Nombre o correo"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">Buscar</Button>
        </form>
      </Card>

      <Card title="Usuarios">
        {errorEdit && <p className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{errorEdit}</p>}
        <Table
          columnas={COLUMNAS_USUARIOS}
          ordenarPor={orden.ordenarPor}
          orden={orden.orden}
          onOrdenar={handleOrdenar}
          pie={(
            <Paginacion
              pagina={paginacion.pagina}
              totalPaginas={paginacion.totalPaginas}
              total={paginacion.total}
              onCambiar={cargar}
            />
          )}
        >
          {usuarios.length === 0 && <TablaVacia colSpan={5} />}
          {usuarios.map((u) => (
            <Fila key={u.id}>
              {editandoId === u.id ? (
                <>
                  <Celda className="font-medium text-gray-800">{u.nombre}</Celda>
                  <Celda>{u.correo}</Celda>
                  <Celda>
                    <Select
                      id={`rolUsuario-${u.id}`}
                      value={editForm.rolId}
                      onChange={(e) => setEditForm((f) => ({ ...f, rolId: e.target.value }))}
                      className="py-1.5"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.nombre}</option>
                      ))}
                    </Select>
                  </Celda>
                  <Celda>
                    <Select
                      id={`estadoUsuario-${u.id}`}
                      value={editForm.estado}
                      onChange={(e) => setEditForm((f) => ({ ...f, estado: e.target.value }))}
                      className="py-1.5"
                    >
                      <option value="ACTIVO">Activo</option>
                      <option value="INACTIVO">Inactivo</option>
                      <option value="BLOQUEADO">Bloqueado</option>
                    </Select>
                  </Celda>
                  <Celda className="text-right">
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => guardarEdicion(u.id)} className="text-sm text-primary-600 hover:underline">
                        Guardar
                      </button>
                      <button type="button" onClick={cancelarEdicion} className="text-sm text-gray-500 hover:underline">
                        Cancelar
                      </button>
                    </div>
                  </Celda>
                </>
              ) : (
                <>
                  <Celda className="font-medium text-gray-800">{u.nombre}</Celda>
                  <Celda>{u.correo}</Celda>
                  <Celda>{u.rol?.nombre || '—'}</Celda>
                  <Celda><Badge tono={ESTADO_TONO[u.estado] || 'gray'}>{u.estado}</Badge></Celda>
                  <Celda className="text-right">
                    <button type="button" onClick={() => iniciarEdicion(u)} className="text-sm text-primary-600 hover:underline">
                      Editar
                    </button>
                  </Celda>
                </>
              )}
            </Fila>
          ))}
        </Table>
      </Card>

      <Card title="Nuevo usuario">
        {roles.length === 0 && <p className="mb-4 text-sm text-gray-500">Cargando roles disponibles...</p>}
        <form onSubmit={agregar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="nombreUsuario" label="Nombre" value={form.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
          <Input id="correoUsuario" label="Correo" type="email" value={form.correo} onChange={(e) => actualizarCampo('correo', e.target.value)} required />
          <Input id="passwordUsuario" label="Contraseña" type="password" minLength={8} value={form.password} onChange={(e) => actualizarCampo('password', e.target.value)} required />
          <Select id="rolUsuarioNuevo" label="Rol" value={form.rolId} onChange={(e) => actualizarCampo('rolId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </Select>
          {error && <p className="sm:col-span-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
          <div className="sm:col-span-2">
            <Button type="submit">Crear usuario</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default UsuariosPage;
