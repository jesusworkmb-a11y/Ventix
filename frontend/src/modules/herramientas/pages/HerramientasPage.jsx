import { useEffect, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import {
  exportarArticulos,
  exportarClientes,
  exportarProveedores,
  exportarListaPrecio,
  importarArticulos,
  importarClientes,
  importarProveedores,
  importarListaPrecio,
} from '../api/herramientas.api';
import { listarListasPrecio } from '../../catalogo/api/catalogo.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Select from '../../../shared/ui/Select';
import Table, { Fila, Celda } from '../../../shared/ui/Table';

const TIPOS_IMPORTAR = {
  articulos: {
    etiqueta: 'Artículos',
    etiquetaResultado: 'Creados',
    fn: importarArticulos,
    columnas:
      'tipo, sku, codigoBarras, clave, nombre, descripcion, categoria, marca, unidadBase, ' +
      'impuesto, claveProdServSat, costo, precio, stockMinimo, stockMaximo, activo. La unidad ' +
      'debe existir ya en Configuración de catálogo. Los artículos tipo Kit no se pueden ' +
      'importar por CSV (necesitan definir sus componentes) — créalos en Artículos.',
  },
  clientes: {
    etiqueta: 'Clientes',
    etiquetaResultado: 'Creados',
    fn: importarClientes,
    columnas:
      'nombre, telefono, correo, rfc, direccion, listaPrecio, domicilioFiscalCp, ' +
      'regimenFiscalClave, usoCfdiPreferido, activo. La lista de precio debe existir ya en ' +
      'Configuración de catálogo.',
  },
  proveedores: {
    etiqueta: 'Proveedores',
    etiquetaResultado: 'Creados',
    fn: importarProveedores,
    columnas: 'nombre, telefono, correo, rfc, direccion, activo.',
  },
  listaPrecio: {
    etiqueta: 'Lista de precio',
    etiquetaResultado: 'Precios actualizados',
    requiereLista: true,
    fn: (csv, listaPrecioId) => importarListaPrecio(listaPrecioId, csv),
    columnas:
      'sku, codigoBarras, nombre, precio. Identifica cada artículo por sku (si lo trae), si no ' +
      'por código de barras, si no por nombre exacto — no crea artículos nuevos, solo fija su ' +
      'precio en la lista elegida abajo. Los artículos deben existir ya en Catálogo.',
  },
};

function HerramientasPage() {
  const [listas, setListas] = useState([]);
  const [tipoImportar, setTipoImportar] = useState('articulos');
  const [listaPrecioId, setListaPrecioId] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    listarListasPrecio().then(setListas).catch(() => {});
  }, []);

  async function manejarExportar(fn) {
    setError('');
    try {
      await fn();
    } catch (err) {
      setError('No se pudo exportar el archivo.');
    }
  }

  async function manejarImportar(e) {
    e.preventDefault();
    setError('');
    setResultado(null);
    if (!archivo) {
      setError('Selecciona un archivo CSV.');
      return;
    }
    const tipo = TIPOS_IMPORTAR[tipoImportar];
    if (tipo.requiereLista && !listaPrecioId) {
      setError('Selecciona a qué lista de precio importar.');
      return;
    }
    setCargando(true);
    try {
      const texto = await archivo.text();
      const data = await tipo.fn(texto, listaPrecioId);
      setResultado(data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo importar el archivo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Herramientas</h1>
        <p className="text-sm text-gray-500">Exportá tus datos o importá en lote desde CSV.</p>
      </div>

      <Card title="Exportar">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => manejarExportar(exportarArticulos)}>
            <Download size={16} /> Artículos
          </Button>
          <Button variant="secondary" onClick={() => manejarExportar(exportarClientes)}>
            <Download size={16} /> Clientes
          </Button>
          <Button variant="secondary" onClick={() => manejarExportar(exportarProveedores)}>
            <Download size={16} /> Proveedores
          </Button>
          {listas.map((l) => (
            <Button
              key={l.id}
              variant="secondary"
              onClick={() => manejarExportar(() => exportarListaPrecio(l.id, `lista-precio-${l.nombre}.csv`))}
            >
              <Download size={16} /> Lista de precio: {l.nombre}
            </Button>
          ))}
        </div>
      </Card>

      <Card title="Importar">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="max-w-xs">
            <Select
              label="Qué importar"
              value={tipoImportar}
              onChange={(e) => {
                setTipoImportar(e.target.value);
                setListaPrecioId('');
                setResultado(null);
                setError('');
              }}
            >
              {Object.entries(TIPOS_IMPORTAR).map(([clave, { etiqueta }]) => (
                <option key={clave} value={clave}>
                  {etiqueta}
                </option>
              ))}
            </Select>
          </div>
          {TIPOS_IMPORTAR[tipoImportar].requiereLista && (
            <div className="max-w-xs">
              <Select
                label="A qué lista de precio"
                value={listaPrecioId}
                onChange={(e) => setListaPrecioId(e.target.value)}
              >
                <option value="">Selecciona una lista</option>
                {listas.map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </Select>
            </div>
          )}
        </div>
        <p className="mb-4 text-sm text-gray-500">
          CSV con columnas: {TIPOS_IMPORTAR[tipoImportar].columnas}
        </p>
        <form onSubmit={manejarImportar} className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setArchivo(e.target.files[0] || null)}
            className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
          <Button type="submit" disabled={cargando}>
            <Upload size={16} /> {cargando ? 'Importando...' : 'Importar'}
          </Button>
        </form>
      </Card>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}

      {resultado && (
        <Card title="Resultado de la importación">
          <p className="mb-4 text-sm text-gray-700">
            {TIPOS_IMPORTAR[tipoImportar].etiquetaResultado}:{' '}
            <span className="font-semibold text-success-700">
              {resultado.creados ?? resultado.actualizados}
            </span>
          </p>
          {resultado.errores.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-danger-700">Errores</h3>
              <Table columnas={['Fila', 'Mensaje']}>
                {resultado.errores.map((e, i) => (
                  <Fila key={i}>
                    <Celda>{e.fila}</Celda>
                    <Celda>{e.mensaje}</Celda>
                  </Fila>
                ))}
              </Table>
            </div>
          )}
          {resultado.advertencias.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-warning-700">Advertencias</h3>
              <Table columnas={['Fila', 'Mensaje']}>
                {resultado.advertencias.map((a, i) => (
                  <Fila key={i}>
                    <Celda>{a.fila}</Celda>
                    <Celda>{a.mensaje}</Celda>
                  </Fila>
                ))}
              </Table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export default HerramientasPage;
