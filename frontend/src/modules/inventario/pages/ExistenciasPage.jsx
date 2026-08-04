import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarExistencias, establecerExistenciaInicial } from '../api/inventario.api';
import { listarSucursales } from '../../core/api/core.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';

const FORM_VACIO = { sucursalId: '', articuloId: '', cantidad: '' };

function ExistenciasPage() {
  const [existencias, setExistencias] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');

  function cargarExistencias() {
    listarExistencias().then(setExistencias).catch(() => {});
  }

  useEffect(() => {
    cargarExistencias();
    listarSucursales().then(setSucursales).catch(() => {});
    listarArticulos().then(setArticulos).catch(() => {});
  }, []);

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function agregar(e) {
    e.preventDefault();
    setError('');
    try {
      await establecerExistenciaInicial({
        sucursalId: form.sucursalId,
        articuloId: form.articuloId,
        cantidad: Number(form.cantidad),
      });
      setForm(FORM_VACIO);
      cargarExistencias();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo establecer la existencia inicial.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Existencias</h1>
        <p className="text-sm text-gray-500">Stock actual por sucursal y artículo.</p>
      </div>

      {articulos.length === 0 && (
        <p className="rounded-lg bg-warning-50 px-4 py-2.5 text-sm text-warning-700">
          Primero da de alta artículos en el <Link to="/catalogo/articulos" className="font-medium underline">catálogo</Link>.
        </p>
      )}

      <Card title="Existencias por sucursal">
        <Table columnas={['Sucursal', 'Artículo', 'SKU', 'Cantidad']}>
          {existencias.length === 0 && <TablaVacia colSpan={4} />}
          {existencias.map((e) => (
            <Fila key={e.id}>
              <Celda>{e.sucursal?.nombre}</Celda>
              <Celda className="font-medium text-gray-800">{e.articulo?.nombre}</Celda>
              <Celda>{e.articulo?.sku || '—'}</Celda>
              <Celda>{e.cantidad}</Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <Card title="Establecer existencia inicial">
        <p className="mb-4 text-sm text-gray-500">
          Solo para un artículo que todavía no tiene existencia registrada en esa sucursal.
          Para corregir una existencia ya en uso, hacé un ajuste.
        </p>
        <form onSubmit={agregar} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select id="sucursalExistencia" label="Sucursal" value={form.sucursalId} onChange={(e) => actualizarCampo('sucursalId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
          <Select id="articuloExistencia" label="Artículo" value={form.articuloId} onChange={(e) => actualizarCampo('articuloId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {articulos.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </Select>
          <Input
            id="cantidadExistencia"
            label="Cantidad"
            type="number"
            step="0.01"
            min="0"
            value={form.cantidad}
            onChange={(e) => actualizarCampo('cantidad', e.target.value)}
            required
          />
          {error && <p className="sm:col-span-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
          <div className="sm:col-span-3">
            <Button type="submit">Establecer existencia</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default ExistenciasPage;
