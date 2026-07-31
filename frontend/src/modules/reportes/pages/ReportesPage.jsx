import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  reporteVentas,
  reporteArticulosMasVendidos,
  reporteInventarioValorizado,
  reporteCompras,
  reporteCaja,
} from '../api/reportes.api';
import { listarSucursales } from '../../core/api/core.api';

const REPORTES = {
  ventas: { etiqueta: 'Ventas por período', fn: reporteVentas, usaFechas: true, usaSucursal: true },
  articulos: { etiqueta: 'Artículos más vendidos', fn: reporteArticulosMasVendidos, usaFechas: true, usaSucursal: true },
  inventario: { etiqueta: 'Inventario valorizado', fn: reporteInventarioValorizado, usaFechas: false, usaSucursal: true },
  compras: { etiqueta: 'Compras por proveedor', fn: reporteCompras, usaFechas: true, usaSucursal: true },
  caja: { etiqueta: 'Cortes de caja', fn: reporteCaja, usaFechas: true, usaSucursal: false },
};

function ReportesPage() {
  const [tipo, setTipo] = useState('ventas');
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listarSucursales().then(setSucursales).catch(() => {});
  }, []);

  const config = REPORTES[tipo];

  async function generar(e) {
    e.preventDefault();
    setError('');
    setResultado(null);
    try {
      const params = {};
      if (config.usaFechas) {
        if (desde) params.desde = desde;
        if (hasta) params.hasta = hasta;
      }
      if (config.usaSucursal && sucursalId) params.sucursalId = sucursalId;
      const data = await config.fn(params);
      setResultado(data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo generar el reporte.');
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 800 }}>
      <p><Link to="/dashboard">← Volver al dashboard</Link></p>
      <h1>Reportes</h1>

      <form
        onSubmit={generar}
        style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}
      >
        <select value={tipo} onChange={(e) => { setTipo(e.target.value); setResultado(null); }}>
          {Object.entries(REPORTES).map(([clave, r]) => (
            <option key={clave} value={clave}>{r.etiqueta}</option>
          ))}
        </select>
        {config.usaFechas && (
          <>
            <label>Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
            <label>Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          </>
        )}
        {config.usaSucursal && (
          <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        )}
        <button type="submit">Generar</button>
      </form>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {resultado && tipo === 'ventas' && (
        <div>
          <p>Número de ventas: {resultado.numeroVentas}</p>
          <p>Subtotal: {resultado.subtotal} — Impuestos: {resultado.impuestos} — Total: {resultado.total}</p>
          <p>Ticket promedio: {Number(resultado.ticketPromedio).toFixed(2)}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Método</th><th style={{ textAlign: 'left' }}>Monto</th></tr></thead>
            <tbody>
              {resultado.porMetodoPago.map((p) => (
                <tr key={p.metodo}><td>{p.metodo}</td><td>{p.monto}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resultado && tipo === 'articulos' && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th style={{ textAlign: 'left' }}>Artículo</th><th style={{ textAlign: 'left' }}>Cantidad</th><th style={{ textAlign: 'left' }}>Monto</th></tr>
          </thead>
          <tbody>
            {resultado.map((r) => (
              <tr key={r.articulo?.id}>
                <td>{r.articulo?.nombre}</td>
                <td>{r.cantidad}</td>
                <td>{r.monto.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {resultado && tipo === 'inventario' && (
        <div>
          <p>Valor total: {resultado.valorTotal.toFixed(2)}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Sucursal</th><th style={{ textAlign: 'left' }}>Valor</th></tr></thead>
            <tbody>
              {resultado.porSucursal.map((s) => (
                <tr key={s.sucursal.id}><td>{s.sucursal.nombre}</td><td>{s.valor.toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
          <h3>Stock bajo</h3>
          {resultado.stockBajo.length === 0 ? (
            <p>Ningún artículo por debajo de su stock mínimo.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Artículo</th>
                  <th style={{ textAlign: 'left' }}>Sucursal</th>
                  <th style={{ textAlign: 'left' }}>Cantidad</th>
                  <th style={{ textAlign: 'left' }}>Mínimo</th>
                </tr>
              </thead>
              <tbody>
                {resultado.stockBajo.map((r, i) => (
                  <tr key={i}>
                    <td>{r.articulo.nombre}</td><td>{r.sucursal.nombre}</td><td>{r.cantidad}</td><td>{r.stockMinimo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {resultado && tipo === 'compras' && (
        <div>
          <p>Total: {resultado.total} — Número de compras: {resultado.numeroCompras}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={{ textAlign: 'left' }}>Proveedor</th><th style={{ textAlign: 'left' }}>Total</th><th style={{ textAlign: 'left' }}>Compras</th></tr>
            </thead>
            <tbody>
              {resultado.porProveedor.map((p) => (
                <tr key={p.proveedor.id}>
                  <td>{p.proveedor.nombre}</td><td>{p.total.toFixed(2)}</td><td>{p.numeroCompras}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resultado && tipo === 'caja' && (
        <div>
          <p>Diferencia acumulada: {resultado.totalDiferencias.toFixed(2)}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Caja</th>
                <th style={{ textAlign: 'left' }}>Fondo</th>
                <th style={{ textAlign: 'left' }}>Esperado</th>
                <th style={{ textAlign: 'left' }}>Real</th>
                <th style={{ textAlign: 'left' }}>Diferencia</th>
                <th style={{ textAlign: 'left' }}>Cerrada</th>
              </tr>
            </thead>
            <tbody>
              {resultado.sesiones.map((s) => (
                <tr key={s.id}>
                  <td>{s.caja?.nombre}</td>
                  <td>{s.fondoInicial}</td>
                  <td>{s.saldoEsperado}</td>
                  <td>{s.saldoReal}</td>
                  <td>{s.diferencia}</td>
                  <td>{new Date(s.cerradaEn).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ReportesPage;
