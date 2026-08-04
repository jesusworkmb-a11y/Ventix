import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { listarClientes, crearCliente, actualizarCliente } from '../api/clientes.api';
import { listarListasPrecio } from '../../catalogo/api/catalogo.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';
import Modal from '../../../shared/ui/Modal';
import Paginacion from '../../../shared/ui/Paginacion';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';

const COLUMNAS = [
  { label: 'Nombre', clave: 'nombre', ordenable: true },
  { label: 'Teléfono', clave: null },
  { label: 'Correo', clave: null },
  { label: 'Activo', clave: 'activo', ordenable: true },
  { label: 'Lista de precio', clave: null },
  { label: '', clave: null },
];

const FORM_VACIO = { nombre: '', telefono: '', correo: '', rfc: '', direccion: '', listaPrecioId: '' };

function clienteAForm(c) {
  return {
    nombre: c.nombre,
    telefono: c.telefono || '',
    correo: c.correo || '',
    rfc: c.rfc || '',
    direccion: c.direccion || '',
    listaPrecioId: c.listaPrecioId || '',
    activo: c.activo,
  };
}

function ClientesPage() {
  const location = useLocation();
  const [clientes, setClientes] = useState([]);
  const [listasPrecio, setListasPrecio] = useState([]);
  // Prefil con el término del buscador global de la barra superior (TopBar.jsx), si se
  // llegó acá desde un resultado de esa categoría.
  const [buscar, setBuscar] = useState(() => location.state?.buscar || '');
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [orden, setOrden] = useState({ ordenarPor: 'nombre', orden: 'asc' });
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');

  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState(FORM_VACIO);
  const [errorEdit, setErrorEdit] = useState('');

  function cargar(pagina = 1) {
    listarClientes({
      buscar: buscar || undefined,
      pagina,
      porPagina: 20,
      ordenarPor: orden.ordenarPor,
      orden: orden.orden,
    })
      .then((r) => {
        setClientes(r.datos);
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
    listarListasPrecio().then(setListasPrecio).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden]);

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      await crearCliente({
        nombre: form.nombre,
        telefono: form.telefono || undefined,
        correo: form.correo || undefined,
        rfc: form.rfc || undefined,
        direccion: form.direccion || undefined,
        listaPrecioId: form.listaPrecioId || undefined,
      });
      setForm(FORM_VACIO);
      cargar(1);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el cliente.');
    }
  }

  async function cambiarListaPrecio(cliente, listaPrecioId) {
    setError('');
    try {
      await actualizarCliente(cliente.id, { listaPrecioId: listaPrecioId || null });
      cargar(paginacion.pagina);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo asignar la lista de precio.');
    }
  }

  function iniciarEdicion(cliente) {
    setErrorEdit('');
    setEditandoId(cliente.id);
    setEditForm(clienteAForm(cliente));
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setErrorEdit('');
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    setErrorEdit('');
    try {
      await actualizarCliente(editandoId, {
        nombre: editForm.nombre,
        telefono: editForm.telefono || undefined,
        correo: editForm.correo || undefined,
        rfc: editForm.rfc || undefined,
        direccion: editForm.direccion || undefined,
        listaPrecioId: editForm.listaPrecioId || null,
        activo: editForm.activo,
      });
      setEditandoId(null);
      cargar(paginacion.pagina);
    } catch (err) {
      setErrorEdit(err.response?.data?.error || 'No se pudo actualizar el cliente.');
    }
  }

  function buscarSubmit(e) {
    e.preventDefault();
    cargar(1);
  }

  const clienteEnEdicion = clientes.find((c) => c.id === editandoId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <p className="text-sm text-gray-500">Directorio de clientes y sus listas de precio asignadas.</p>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}

      <Card>
        <form onSubmit={buscarSubmit} className="flex items-end gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-[38px] text-gray-400" />
            <Input
              id="buscarCliente"
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

      <Card title="Clientes">
        <Table
          columnas={COLUMNAS}
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
          {clientes.length === 0 && <TablaVacia colSpan={6} />}
          {clientes.map((c) => (
            <Fila key={c.id}>
              <Celda className="font-medium text-gray-800">
                {c.nombre}{c.esGeneral && <Badge tono="gray">general</Badge>}
              </Celda>
              <Celda>{c.telefono || '—'}</Celda>
              <Celda>{c.correo || '—'}</Celda>
              <Celda><Badge tono={c.activo ? 'success' : 'gray'}>{c.activo ? 'Sí' : 'No'}</Badge></Celda>
              <Celda>
                {listasPrecio.length > 0 ? (
                  <Select
                    id={`listaPrecio-${c.id}`}
                    value={c.listaPrecioId || ''}
                    onChange={(e) => cambiarListaPrecio(c, e.target.value)}
                    className="py-1.5"
                  >
                    <option value="">Precio base</option>
                    {listasPrecio.map((l) => (
                      <option key={l.id} value={l.id}>{l.nombre}</option>
                    ))}
                  </Select>
                ) : '—'}
              </Celda>
              <Celda className="text-right">
                <button type="button" onClick={() => iniciarEdicion(c)} className="text-sm text-primary-600 hover:underline">
                  Editar
                </button>
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <Card title="Nuevo cliente">
        <form onSubmit={agregar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="nombreCliente" label="Nombre" value={form.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
          <Input id="telefonoCliente" label="Teléfono" value={form.telefono} onChange={(e) => actualizarCampo('telefono', e.target.value)} />
          <Input id="correoCliente" label="Correo" type="email" value={form.correo} onChange={(e) => actualizarCampo('correo', e.target.value)} />
          <Input id="rfcCliente" label="RFC" value={form.rfc} onChange={(e) => actualizarCampo('rfc', e.target.value)} />
          <Input id="direccionCliente" label="Dirección" value={form.direccion} onChange={(e) => actualizarCampo('direccion', e.target.value)} />
          <Select id="listaPrecioCliente" label="Lista de precio" value={form.listaPrecioId} onChange={(e) => actualizarCampo('listaPrecioId', e.target.value)}>
            <option value="">Precio base</option>
            {listasPrecio.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </Select>
          <div className="sm:col-span-2">
            <Button type="submit">Crear cliente</Button>
          </div>
        </form>
      </Card>

      <Modal abierto={editandoId !== null} onCerrar={cancelarEdicion} titulo="Editar cliente">
        <form onSubmit={guardarEdicion} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="nombreEditCliente" label="Nombre" value={editForm.nombre} onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))} required />
          <Input id="telefonoEditCliente" label="Teléfono" value={editForm.telefono} onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))} />
          <Input id="correoEditCliente" label="Correo" type="email" value={editForm.correo} onChange={(e) => setEditForm((f) => ({ ...f, correo: e.target.value }))} />
          <Input id="rfcEditCliente" label="RFC" value={editForm.rfc} onChange={(e) => setEditForm((f) => ({ ...f, rfc: e.target.value }))} />
          <Input id="direccionEditCliente" label="Dirección" value={editForm.direccion} onChange={(e) => setEditForm((f) => ({ ...f, direccion: e.target.value }))} />
          <Select id="listaPrecioEditCliente" label="Lista de precio" value={editForm.listaPrecioId} onChange={(e) => setEditForm((f) => ({ ...f, listaPrecioId: e.target.value }))}>
            <option value="">Precio base</option>
            {listasPrecio.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </Select>
          {clienteEnEdicion && !clienteEnEdicion.esGeneral && (
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={editForm.activo}
                onChange={(e) => setEditForm((f) => ({ ...f, activo: e.target.checked }))}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Activo (desmarcá para dejar de poderle vender)
            </label>
          )}
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

export default ClientesPage;
