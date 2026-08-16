import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { crearCompra } from '../api/compras.api';
import { listarProveedores } from '../../proveedores/api/proveedores.api';
import { listarSucursales } from '../../core/api/core.api';
import { listarArticulos, listarUnidades } from '../../catalogo/api/catalogo.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import { formatoMoneda } from '../../../shared/format';

const FORM_VACIO = {
  proveedorId: '',
  sucursalId: '',
  articuloId: '',
  unidadId: '',
  cantidad: '',
  costo: '',
};

function ComprasPage() {
  const [proveedores, setProveedores] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');
  const [creada, setCreada] = useState(null);

  useEffect(() => {
    listarProveedores().then(setProveedores).catch(() => {});
    listarSucursales().then(setSucursales).catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
    listarUnidades().then(setUnidades).catch(() => {});
  }, []);

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      const compra = await crearCompra({
        proveedorId: form.proveedorId,
        sucursalId: form.sucursalId,
        detalles: [
          {
            articuloId: form.articuloId,
            unidadId: form.unidadId,
            cantidad: Number(form.cantidad),
            costo: Number(form.costo),
          },
        ],
      });
      setForm(FORM_VACIO);
      setCreada(compra);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la compra.');
    }
  }

  const articuloSeleccionado = articulos.find((a) => a.id === form.articuloId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
          <p className="text-sm text-gray-500">Registrá compras a proveedores.</p>
        </div>
        <Link
          to="/compras/recientes"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Ver compras recientes
        </Link>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
      {creada && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">
          <p>Compra {creada.folio} registrada. Total: {formatoMoneda(creada.total)}</p>
          <Link to="/compras/recientes" className="font-medium underline">Ver en Compras recientes</Link>
        </div>
      )}

      <Card title="Nueva compra">
        <p className="mb-4 text-sm text-gray-500">Una línea por compra desde aquí. Para varias líneas, usa la API.</p>
        <form onSubmit={agregar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select id="proveedorId" label="Proveedor" value={form.proveedorId} onChange={(e) => actualizarCampo('proveedorId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {proveedores.filter((p) => p.activo).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
          <Select id="sucursalId" label="Sucursal" value={form.sucursalId} onChange={(e) => actualizarCampo('sucursalId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
          <Select
            id="articuloIdCompra"
            label="Artículo"
            value={form.articuloId}
            onChange={(e) => {
              const articulo = articulos.find((a) => a.id === e.target.value);
              setForm((f) => ({ ...f, articuloId: e.target.value, unidadId: articulo?.unidadBaseId || '' }));
            }}
            required
          >
            <option value="">Selecciona...</option>
            {articulos.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </Select>
          <Select id="unidadId" label="Unidad" value={form.unidadId} onChange={(e) => actualizarCampo('unidadId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {articuloSeleccionado && (
              <option value={articuloSeleccionado.unidadBaseId}>{articuloSeleccionado.unidadBase?.nombre} (base)</option>
            )}
            {(articuloSeleccionado?.unidadesAlternas || []).map((u) => (
              <option key={u.unidadId} value={u.unidadId}>
                {u.unidad?.nombre} (=&nbsp;{Number(u.factor)}&nbsp;{articuloSeleccionado?.unidadBase?.nombre})
              </option>
            ))}
          </Select>
          <Input
            id="cantidadCompra"
            label="Cantidad"
            type="number"
            step="0.01"
            min="0"
            value={form.cantidad}
            onChange={(e) => actualizarCampo('cantidad', e.target.value)}
            required
          />
          <Input
            id="costoCompra"
            label="Costo por unidad"
            type="number"
            step="0.01"
            min="0"
            value={form.costo}
            onChange={(e) => actualizarCampo('costo', e.target.value)}
            required
          />
          <div className="sm:col-span-2">
            <Button type="submit">Registrar compra</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default ComprasPage;
