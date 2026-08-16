import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { crearCliente } from '../api/clientes.api';
import { listarListasPrecio } from '../../catalogo/api/catalogo.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import SelectorCatalogoSat from '../../../shared/ui/SelectorCatalogoSat';

const FORM_VACIO = {
  nombre: '',
  telefono: '',
  correo: '',
  rfc: '',
  direccion: '',
  domicilioFiscalCp: '',
  regimenFiscalClave: null,
  usoCfdiPreferido: null,
  listaPrecioId: '',
};

function ClienteNuevoPage() {
  const [listasPrecio, setListasPrecio] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');
  const [creado, setCreado] = useState(null);

  useEffect(() => {
    listarListasPrecio().then(setListasPrecio).catch(() => {});
  }, []);

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function agregar(e) {
    e.preventDefault();
    setError('');
    setCreado(null);
    try {
      const cliente = await crearCliente({
        nombre: form.nombre,
        telefono: form.telefono || undefined,
        correo: form.correo || undefined,
        rfc: form.rfc || undefined,
        direccion: form.direccion || undefined,
        domicilioFiscalCp: form.domicilioFiscalCp || undefined,
        regimenFiscalClave: form.regimenFiscalClave || undefined,
        usoCfdiPreferido: form.usoCfdiPreferido || undefined,
        listaPrecioId: form.listaPrecioId || undefined,
      });
      setForm(FORM_VACIO);
      setCreado(cliente);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el cliente.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo cliente</h1>
        <p className="text-sm text-gray-500">Dar de alta un cliente en el directorio.</p>
      </div>

      <Card title="Datos del cliente">
        <form onSubmit={agregar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="nombreCliente" label="Nombre" value={form.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
          <Input id="telefonoCliente" label="Teléfono" value={form.telefono} onChange={(e) => actualizarCampo('telefono', e.target.value)} />
          <Input id="correoCliente" label="Correo" type="email" value={form.correo} onChange={(e) => actualizarCampo('correo', e.target.value)} />
          <Input id="rfcCliente" label="RFC" value={form.rfc} onChange={(e) => actualizarCampo('rfc', e.target.value)} />
          <Input id="direccionCliente" label="Dirección" value={form.direccion} onChange={(e) => actualizarCampo('direccion', e.target.value)} />
          <Input
            id="domicilioFiscalCpCliente"
            label="Código postal (domicilio fiscal)"
            value={form.domicilioFiscalCp}
            onChange={(e) => actualizarCampo('domicilioFiscalCp', e.target.value)}
          />
          <SelectorCatalogoSat
            id="regimenFiscalCliente"
            tipo="RegimenFiscal"
            label="Régimen fiscal (opcional)"
            value={form.regimenFiscalClave}
            onChange={(v) => actualizarCampo('regimenFiscalClave', v)}
            placeholder="Buscar régimen fiscal…"
          />
          <SelectorCatalogoSat
            id="usoCfdiCliente"
            tipo="UsoCfdi"
            label="Uso del CFDI preferido (opcional)"
            value={form.usoCfdiPreferido}
            onChange={(v) => actualizarCampo('usoCfdiPreferido', v)}
            placeholder="Buscar uso de CFDI…"
          />
          <Select id="listaPrecioCliente" label="Lista de precio" value={form.listaPrecioId} onChange={(e) => actualizarCampo('listaPrecioId', e.target.value)}>
            <option value="">Precio base</option>
            {listasPrecio.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </Select>
          {error && <p className="sm:col-span-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
          {creado && (
            <p className="sm:col-span-2 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
              «{creado.nombre}» creado. Vela en{' '}
              <Link to="/clientes" className="font-medium underline">Clientes</Link>.
            </p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit">Crear cliente</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default ClienteNuevoPage;
