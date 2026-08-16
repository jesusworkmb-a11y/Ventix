import { useState } from 'react';
import { Link } from 'react-router-dom';
import { crearProveedor } from '../api/proveedores.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';

const FORM_VACIO = { nombre: '', telefono: '', correo: '', rfc: '', direccion: '' };

function ProveedorNuevoPage() {
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');
  const [creado, setCreado] = useState(null);

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function agregar(e) {
    e.preventDefault();
    setError('');
    setCreado(null);
    try {
      const proveedor = await crearProveedor({
        nombre: form.nombre,
        telefono: form.telefono || undefined,
        correo: form.correo || undefined,
        rfc: form.rfc || undefined,
        direccion: form.direccion || undefined,
      });
      setForm(FORM_VACIO);
      setCreado(proveedor);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el proveedor.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo proveedor</h1>
        <p className="text-sm text-gray-500">Dar de alta un proveedor en el directorio.</p>
      </div>

      <Card title="Datos del proveedor">
        <form onSubmit={agregar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="nombreProveedor" label="Nombre" value={form.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
          <Input id="telefonoProveedor" label="Teléfono" value={form.telefono} onChange={(e) => actualizarCampo('telefono', e.target.value)} />
          <Input id="correoProveedor" label="Correo" type="email" value={form.correo} onChange={(e) => actualizarCampo('correo', e.target.value)} />
          <Input id="rfcProveedor" label="RFC" value={form.rfc} onChange={(e) => actualizarCampo('rfc', e.target.value)} />
          <Input id="direccionProveedor" label="Dirección" value={form.direccion} onChange={(e) => actualizarCampo('direccion', e.target.value)} />
          {error && <p className="sm:col-span-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
          {creado && (
            <p className="sm:col-span-2 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
              «{creado.nombre}» creado. Vela en{' '}
              <Link to="/proveedores" className="font-medium underline">Proveedores</Link>.
            </p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit">Crear proveedor</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default ProveedorNuevoPage;
