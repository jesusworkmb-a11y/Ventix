import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { listarProveedores, crearProveedor, actualizarProveedor } from '../api/proveedores.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Badge from '../../../shared/ui/Badge';
import Modal from '../../../shared/ui/Modal';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
        <p className="text-sm text-gray-500">Directorio de proveedores para tus compras.</p>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}

      <Card>
        <form onSubmit={buscarSubmit} className="flex items-end gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-[38px] text-gray-400" />
            <Input
              id="buscarProveedor"
              label="Buscar"
              placeholder="Nombre, correo, teléfono o RFC"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">Buscar</Button>
        </form>
      </Card>

      <Card title="Proveedores">
        <Table columnas={['Nombre', 'Teléfono', 'Correo', 'Activo', '']}>
          {proveedores.length === 0 && <TablaVacia colSpan={5} />}
          {proveedores.map((p) => (
            <Fila key={p.id}>
              <Celda className="font-medium text-gray-800">{p.nombre}</Celda>
              <Celda>{p.telefono || '—'}</Celda>
              <Celda>{p.correo || '—'}</Celda>
              <Celda><Badge tono={p.activo ? 'success' : 'gray'}>{p.activo ? 'Sí' : 'No'}</Badge></Celda>
              <Celda className="text-right">
                <button type="button" onClick={() => iniciarEdicion(p)} className="text-sm text-primary-600 hover:underline">
                  Editar
                </button>
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <Card title="Nuevo proveedor">
        <form onSubmit={agregar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="nombreProveedor" label="Nombre" value={form.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
          <Input id="telefonoProveedor" label="Teléfono" value={form.telefono} onChange={(e) => actualizarCampo('telefono', e.target.value)} />
          <Input id="correoProveedor" label="Correo" type="email" value={form.correo} onChange={(e) => actualizarCampo('correo', e.target.value)} />
          <Input id="rfcProveedor" label="RFC" value={form.rfc} onChange={(e) => actualizarCampo('rfc', e.target.value)} />
          <Input id="direccionProveedor" label="Dirección" value={form.direccion} onChange={(e) => actualizarCampo('direccion', e.target.value)} />
          <div className="sm:col-span-2">
            <Button type="submit">Crear proveedor</Button>
          </div>
        </form>
      </Card>

      <Modal abierto={editandoId !== null} onCerrar={cancelarEdicion} titulo="Editar proveedor">
        <form onSubmit={guardarEdicion} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="nombreEditProveedor" label="Nombre" value={editForm.nombre} onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))} required />
          <Input id="telefonoEditProveedor" label="Teléfono" value={editForm.telefono} onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))} />
          <Input id="correoEditProveedor" label="Correo" type="email" value={editForm.correo} onChange={(e) => setEditForm((f) => ({ ...f, correo: e.target.value }))} />
          <Input id="rfcEditProveedor" label="RFC" value={editForm.rfc} onChange={(e) => setEditForm((f) => ({ ...f, rfc: e.target.value }))} />
          <Input id="direccionEditProveedor" label="Dirección" value={editForm.direccion} onChange={(e) => setEditForm((f) => ({ ...f, direccion: e.target.value }))} />
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={editForm.activo}
              onChange={(e) => setEditForm((f) => ({ ...f, activo: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Activo (desmarcá para dejar de poder registrarle compras)
          </label>
          {errorEdit && <p className="sm:col-span-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{errorEdit}</p>}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={cancelarEdicion}>Cancelar</Button>
            <Button type="submit">Guardar cambios</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ProveedoresPage;
