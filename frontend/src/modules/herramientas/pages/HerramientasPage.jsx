import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import {
  exportarArticulos,
  exportarClientes,
  exportarProveedores,
  importarArticulos,
  importarClientes,
  importarProveedores,
} from '../api/herramientas.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Select from '../../../shared/ui/Select';
import Table, { Fila, Celda } from '../../../shared/ui/Table';

const TIPOS_IMPORTAR = {
  articulos: {
    etiqueta: 'Artículos',
    fn: importarArticulos,
    columnas:
      'tipo, sku, codigoBarras, clave, nombre, descripcion, categoria, marca, unidadBase, ' +
      'impuesto, claveProdServSat, costo, precio, stockMinimo, stockMaximo, activo. La unidad ' +
      'debe existir ya en Configuración de catálogo. Los artículos tipo Kit no se pueden ' +
      'importar por CSV (necesitan definir sus componentes) — créalos en Artículos.',
  },
  clientes: {
    etiqueta: 'Clientes',
    fn: importarClientes,
    columnas:
      'nombre, telefono, correo, rfc, direccion, listaPrecio, domicilioFiscalCp, ' +
      'regimenFiscalClave, usoCfdiPreferido, activo. La lista de precio debe existir ya en ' +
      'Configuración de catálogo.',
  },
  proveedores: {
    etiqueta: 'Proveedores',
    fn: importarProveedores,
    columnas: 'nombre, telefono, correo, rfc, direccion, activo.',
  },
};

function HerramientasPage() {
  const [tipoImportar, setTipoImportar] = useState('articulos');
  const [archivo, setArchivo] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

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
    setCargando(true);
    try {
      const texto = await archivo.text();
      const data = await TIPOS_IMPORTAR[tipoImportar].fn(texto);
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
        </div>
      </Card>

      <Card title="Importar">
        <div className="mb-4 max-w-xs">
          <Select
            label="Qué importar"
            value={tipoImportar}
            onChange={(e) => {
              setTipoImportar(e.target.value);
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
            Creados: <span className="font-semibold text-success-700">{resultado.creados}</span>
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
