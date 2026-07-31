import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  exportarArticulos,
  exportarClientes,
  exportarProveedores,
  importarArticulos,
} from '../api/herramientas.api';

function HerramientasPage() {
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
      const data = await importarArticulos(texto);
      setResultado(data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo importar el archivo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 700 }}>
      <p><Link to="/dashboard">← Volver al dashboard</Link></p>
      <h1>Herramientas</h1>

      <h2>Exportar</h2>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
        <button type="button" onClick={() => manejarExportar(exportarArticulos)}>Artículos</button>
        <button type="button" onClick={() => manejarExportar(exportarClientes)}>Clientes</button>
        <button type="button" onClick={() => manejarExportar(exportarProveedores)}>Proveedores</button>
      </div>

      <h2>Importar artículos</h2>
      <p style={{ color: '#555' }}>
        CSV con columnas: tipo, sku, codigoBarras, clave, nombre, descripcion, categoria, marca,
        unidadBase, impuesto, costo, precio, stockMinimo, stockMaximo. La unidad debe existir ya
        en Configuración de catálogo.
      </p>
      <form
        onSubmit={manejarImportar}
        style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}
      >
        <input type="file" accept=".csv" onChange={(e) => setArchivo(e.target.files[0] || null)} />
        <button type="submit" disabled={cargando}>{cargando ? 'Importando...' : 'Importar'}</button>
      </form>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {resultado && (
        <div>
          <p>Creados: {resultado.creados}</p>
          {resultado.errores.length > 0 && (
            <>
              <h3>Errores</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                <thead><tr><th style={{ textAlign: 'left' }}>Fila</th><th style={{ textAlign: 'left' }}>Mensaje</th></tr></thead>
                <tbody>
                  {resultado.errores.map((e, i) => (
                    <tr key={i}><td>{e.fila}</td><td>{e.mensaje}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {resultado.advertencias.length > 0 && (
            <>
              <h3>Advertencias</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ textAlign: 'left' }}>Fila</th><th style={{ textAlign: 'left' }}>Mensaje</th></tr></thead>
                <tbody>
                  {resultado.advertencias.map((a, i) => (
                    <tr key={i}><td>{a.fila}</td><td>{a.mensaje}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default HerramientasPage;
