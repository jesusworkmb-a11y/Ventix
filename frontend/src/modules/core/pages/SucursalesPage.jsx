import { useEffect, useState } from 'react';
import { listarSucursales, crearSucursal, actualizarSucursal } from '../api/core.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';

const FORM_VACIO = { nombre: '', clave: '', telefono: '', correo: '', direccion: '', responsable: '' };
const EDIT_VACIO = { nombre: '', telefono: '', correo: '', direccion: '', responsable: '', estado: 'ACTIVA' };

const ESTADO_TONO = { ACTIVA: 'success', SUSPENDIDA: 'warning', ARCHIVADA: 'gray' };

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sucursales</h1>
        <p className="text-sm text-gray-500">Puntos de venta y operación de tu empresa.</p>
      </div>

      <Card title="Sucursales">
        {errorEdit && <p className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{errorEdit}</p>}
        <Table columnas={['Nombre', 'Clave', 'Teléfono', 'Estado', '']}>
          {sucursales.length === 0 && <TablaVacia colSpan={5} />}
          {sucursales.map((s) => (
            <Fila key={s.id}>
              {editandoId === s.id ? (
                <>
                  <Celda>
                    <Input
                      id={`nombreSucursal-${s.id}`}
                      value={editForm.nombre}
                      onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                      required
                      className="w-40"
                    />
                  </Celda>
                  <Celda>{s.clave}</Celda>
                  <Celda>
                    <Input
                      id={`telefonoSucursal-${s.id}`}
                      value={editForm.telefono}
                      onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))}
                      className="w-32"
                    />
                  </Celda>
                  <Celda>
                    <Select
                      id={`estadoSucursal-${s.id}`}
                      value={editForm.estado}
                      onChange={(e) => setEditForm((f) => ({ ...f, estado: e.target.value }))}
                      className="py-1.5"
                    >
                      <option value="ACTIVA">Activa</option>
                      <option value="SUSPENDIDA">Suspendida</option>
                      <option value="ARCHIVADA">Archivada</option>
                    </Select>
                  </Celda>
                  <Celda className="text-right">
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => guardarEdicion(s.id)} className="text-sm text-primary-600 hover:underline">
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
                  <Celda className="font-medium text-gray-800">{s.nombre}</Celda>
                  <Celda>{s.clave}</Celda>
                  <Celda>{s.telefono || '—'}</Celda>
                  <Celda><Badge tono={ESTADO_TONO[s.estado] || 'gray'}>{s.estado}</Badge></Celda>
                  <Celda className="text-right">
                    <button type="button" onClick={() => iniciarEdicion(s)} className="text-sm text-primary-600 hover:underline">
                      Editar
                    </button>
                  </Celda>
                </>
              )}
            </Fila>
          ))}
        </Table>
      </Card>

      <Card title="Nueva sucursal">
        <form onSubmit={agregar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="nombreNuevaSucursal" label="Nombre" value={form.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
          <Input id="claveNuevaSucursal" label="Clave" value={form.clave} onChange={(e) => actualizarCampo('clave', e.target.value)} required />
          <Input id="telefonoNuevaSucursal" label="Teléfono" value={form.telefono} onChange={(e) => actualizarCampo('telefono', e.target.value)} />
          <Input id="correoNuevaSucursal" label="Correo" type="email" value={form.correo} onChange={(e) => actualizarCampo('correo', e.target.value)} />
          <Input id="direccionNuevaSucursal" label="Dirección" value={form.direccion} onChange={(e) => actualizarCampo('direccion', e.target.value)} />
          <Input id="responsableNuevaSucursal" label="Responsable" value={form.responsable} onChange={(e) => actualizarCampo('responsable', e.target.value)} />
          {error && <p className="sm:col-span-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
          <div className="sm:col-span-2">
            <Button type="submit">Crear sucursal</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default SucursalesPage;
