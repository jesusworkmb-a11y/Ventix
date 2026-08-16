import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  crearArticulo,
  listarCategorias,
  listarMarcas,
  listarUnidades,
  listarImpuestos,
} from '../api/catalogo.api';
import CampoImagenArticulo from '../components/CampoImagenArticulo';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import SelectorCatalogoSat from '../../../shared/ui/SelectorCatalogoSat';

const FORM_VACIO = {
  tipo: 'PRODUCTO',
  nombre: '',
  sku: '',
  codigoBarras: '',
  unidadBaseId: '',
  categoriaId: '',
  marcaId: '',
  impuestoId: '',
  costo: '',
  precio: '',
  stockMinimo: '',
  stockMaximo: '',
  claveProdServSat: null,
  imagenUrl: null,
};

function ArticuloNuevoPage() {
  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [impuestos, setImpuestos] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');
  const [creado, setCreado] = useState(null);

  useEffect(() => {
    listarCategorias().then(setCategorias).catch(() => {});
    listarMarcas().then(setMarcas).catch(() => {});
    listarUnidades().then(setUnidades).catch(() => {});
    listarImpuestos().then(setImpuestos).catch(() => {});
  }, []);

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function agregar(e) {
    e.preventDefault();
    setError('');
    setCreado(null);
    try {
      const articulo = await crearArticulo({
        tipo: form.tipo,
        nombre: form.nombre,
        sku: form.sku || undefined,
        codigoBarras: form.codigoBarras || undefined,
        unidadBaseId: form.unidadBaseId,
        categoriaId: form.categoriaId || undefined,
        marcaId: form.marcaId || undefined,
        impuestoId: form.impuestoId || undefined,
        costo: form.costo ? Number(form.costo) : undefined,
        precio: form.precio ? Number(form.precio) : undefined,
        stockMinimo: form.stockMinimo ? Number(form.stockMinimo) : undefined,
        stockMaximo: form.stockMaximo ? Number(form.stockMaximo) : undefined,
        claveProdServSat: form.claveProdServSat || undefined,
        imagenUrl: form.imagenUrl || undefined,
      });
      setForm(FORM_VACIO);
      setCreado(articulo);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el artículo.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo artículo</h1>
        <p className="text-sm text-gray-500">Dar de alta un producto o servicio en el catálogo.</p>
      </div>

      {unidades.length === 0 && (
        <p className="rounded-lg bg-warning-50 px-4 py-2.5 text-sm text-warning-700">
          Primero creá al menos una <Link to="/catalogo/configuracion" className="font-medium underline">unidad</Link> para poder dar de alta artículos.
        </p>
      )}

      <Card title="Datos del artículo">
        <form onSubmit={agregar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoImagenArticulo
            idInput="imagenArticulo"
            imagenUrl={form.imagenUrl}
            onChange={(url) => actualizarCampo('imagenUrl', url)}
          />
          <Select id="tipoArticulo" label="Tipo" value={form.tipo} onChange={(e) => actualizarCampo('tipo', e.target.value)}>
            <option value="PRODUCTO">Producto</option>
            <option value="SERVICIO">Servicio</option>
            <option value="KIT">Kit (combo de otros artículos)</option>
          </Select>
          {form.tipo === 'KIT' && (
            <p className="sm:col-span-2 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700">
              Un Kit se vende como un solo artículo, con su propio precio. Después de crearlo,
              agregá sus componentes desde el botón "Componentes" en el listado de Artículos.
            </p>
          )}
          <Input id="nombreArticulo" label="Nombre" value={form.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
          <Input id="skuArticulo" label="SKU" value={form.sku} onChange={(e) => actualizarCampo('sku', e.target.value)} />
          <Input id="codigoBarrasArticulo" label="Código de barras" value={form.codigoBarras} onChange={(e) => actualizarCampo('codigoBarras', e.target.value)} />
          <Select id="unidadArticulo" label="Unidad base" value={form.unidadBaseId} onChange={(e) => actualizarCampo('unidadBaseId', e.target.value)} required>
            <option value="">Selecciona...</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </Select>
          <Select id="categoriaArticulo" label="Categoría" value={form.categoriaId} onChange={(e) => actualizarCampo('categoriaId', e.target.value)}>
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Select>
          <Select id="marcaArticulo" label="Marca" value={form.marcaId} onChange={(e) => actualizarCampo('marcaId', e.target.value)}>
            <option value="">Sin marca</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </Select>
          <Select id="impuestoArticulo" label="Impuesto" value={form.impuestoId} onChange={(e) => actualizarCampo('impuestoId', e.target.value)}>
            <option value="">Sin impuesto</option>
            {impuestos.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre}</option>
            ))}
          </Select>
          <Input id="costoArticulo" label="Costo" type="number" step="0.01" value={form.costo} onChange={(e) => actualizarCampo('costo', e.target.value)} />
          <Input id="precioArticulo" label="Precio" type="number" step="0.01" value={form.precio} onChange={(e) => actualizarCampo('precio', e.target.value)} />
          <Input
            id="stockMinimoArticulo"
            label="Stock mínimo (opcional)"
            type="number"
            step="0.01"
            min="0"
            value={form.stockMinimo}
            onChange={(e) => actualizarCampo('stockMinimo', e.target.value)}
          />
          <SelectorCatalogoSat
            id="claveProdServArticulo"
            tipo="ClaveProdServ"
            label="Clave prod/serv SAT (opcional)"
            value={form.claveProdServSat}
            onChange={(v) => actualizarCampo('claveProdServSat', v)}
            placeholder="Buscar clave SAT…"
          />
          <Input
            id="stockMaximoArticulo"
            label="Stock máximo (opcional)"
            type="number"
            step="0.01"
            min="0"
            value={form.stockMaximo}
            onChange={(e) => actualizarCampo('stockMaximo', e.target.value)}
          />
          {error && <p className="sm:col-span-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
          {creado && (
            <p className="sm:col-span-2 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
              «{creado.nombre}» creado. Vela en{' '}
              <Link to="/catalogo/articulos" className="font-medium underline">Artículos</Link>.
            </p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit">Crear artículo</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default ArticuloNuevoPage;
