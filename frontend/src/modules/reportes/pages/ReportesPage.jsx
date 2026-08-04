import { useEffect, useState } from 'react';
import {
  reporteVentas,
  reporteArticulosMasVendidos,
  reporteInventarioValorizado,
  reporteCompras,
  reporteCaja,
} from '../api/reportes.api';
import { listarSucursales } from '../../core/api/core.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { formatoMoneda } from '../../../shared/format';

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500">Generá reportes de ventas, inventario, compras y caja.</p>
      </div>

      <Card>
        <form onSubmit={generar} className="flex flex-wrap items-end gap-3">
          <Select
            id="tipoReporte"
            label="Reporte"
            value={tipo}
            onChange={(e) => { setTipo(e.target.value); setResultado(null); }}
            className="min-w-[200px]"
          >
            {Object.entries(REPORTES).map(([clave, r]) => (
              <option key={clave} value={clave}>{r.etiqueta}</option>
            ))}
          </Select>
          {config.usaFechas && (
            <>
              <Input id="desdeReporte" label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              <Input id="hastaReporte" label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </>
          )}
          {config.usaSucursal && (
            <Select id="sucursalReporte" label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} className="min-w-[180px]">
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </Select>
          )}
          <Button type="submit">Generar</Button>
        </form>
      </Card>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}

      {resultado && tipo === 'ventas' && (
        <Card title="Ventas por período">
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Número de ventas</p>
              <p className="text-lg font-semibold text-gray-900">{resultado.numeroVentas}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-lg font-semibold text-gray-900">{formatoMoneda(resultado.total)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Devoluciones</p>
              <p className="text-lg font-semibold text-gray-900">{formatoMoneda(resultado.totalDevoluciones)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Neto</p>
              <p className="text-lg font-semibold text-primary-700">{formatoMoneda(resultado.totalNeto)}</p>
            </div>
          </div>
          <p className="mb-4 text-sm text-gray-500">
            Subtotal: {formatoMoneda(resultado.subtotal)} · Impuestos: {formatoMoneda(resultado.impuestos)} · Ticket promedio: {formatoMoneda(resultado.ticketPromedio)}
          </p>
          <Table columnas={['Método', 'Monto']}>
            {resultado.porMetodoPago.length === 0 && <TablaVacia colSpan={2} />}
            {resultado.porMetodoPago.map((p) => (
              <Fila key={p.metodo}>
                <Celda>{p.metodo}</Celda>
                <Celda>{formatoMoneda(p.monto)}</Celda>
              </Fila>
            ))}
          </Table>
        </Card>
      )}

      {resultado && tipo === 'articulos' && (
        <Card title="Artículos más vendidos">
          <Table columnas={['Artículo', 'Cantidad', 'Monto']}>
            {resultado.length === 0 && <TablaVacia colSpan={3} />}
            {resultado.map((r) => (
              <Fila key={r.articulo?.id}>
                <Celda className="font-medium text-gray-800">{r.articulo?.nombre}</Celda>
                <Celda>{r.cantidad}</Celda>
                <Celda>{formatoMoneda(r.monto)}</Celda>
              </Fila>
            ))}
          </Table>
        </Card>
      )}

      {resultado && tipo === 'inventario' && (
        <>
          <Card title="Inventario valorizado">
            <p className="mb-4 text-sm text-gray-500">
              Valor total: <span className="font-semibold text-gray-900">{formatoMoneda(resultado.valorTotal)}</span>
            </p>
            <Table columnas={['Sucursal', 'Valor']}>
              {resultado.porSucursal.map((s) => (
                <Fila key={s.sucursal.id}>
                  <Celda>{s.sucursal.nombre}</Celda>
                  <Celda>{formatoMoneda(s.valor)}</Celda>
                </Fila>
              ))}
            </Table>
          </Card>
          <Card title="Stock bajo">
            {resultado.stockBajo.length === 0 ? (
              <p className="text-sm text-gray-500">Ningún artículo por debajo de su stock mínimo.</p>
            ) : (
              <Table columnas={['Artículo', 'Sucursal', 'Cantidad', 'Mínimo']}>
                {resultado.stockBajo.map((r, i) => (
                  <Fila key={i}>
                    <Celda className="font-medium text-gray-800">{r.articulo.nombre}</Celda>
                    <Celda>{r.sucursal.nombre}</Celda>
                    <Celda>{r.cantidad}</Celda>
                    <Celda>{r.stockMinimo}</Celda>
                  </Fila>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}

      {resultado && tipo === 'compras' && (
        <Card title="Compras por proveedor">
          <p className="mb-4 text-sm text-gray-500">
            Total: <span className="font-semibold text-gray-900">{formatoMoneda(resultado.total)}</span> · Número de compras: {resultado.numeroCompras}
          </p>
          <Table columnas={['Proveedor', 'Total', 'Compras']}>
            {resultado.porProveedor.length === 0 && <TablaVacia colSpan={3} />}
            {resultado.porProveedor.map((p) => (
              <Fila key={p.proveedor.id}>
                <Celda className="font-medium text-gray-800">{p.proveedor.nombre}</Celda>
                <Celda>{formatoMoneda(p.total)}</Celda>
                <Celda>{p.numeroCompras}</Celda>
              </Fila>
            ))}
          </Table>
        </Card>
      )}

      {resultado && tipo === 'caja' && (
        <Card title="Cortes de caja">
          <p className="mb-4 text-sm text-gray-500">
            Diferencia acumulada: <span className="font-semibold text-gray-900">{formatoMoneda(resultado.totalDiferencias)}</span>
          </p>
          <Table columnas={['Caja', 'Fondo', 'Esperado', 'Real', 'Diferencia', 'Cerrada']}>
            {resultado.sesiones.length === 0 && <TablaVacia colSpan={6} />}
            {resultado.sesiones.map((s) => (
              <Fila key={s.id}>
                <Celda className="font-medium text-gray-800">{s.caja?.nombre}</Celda>
                <Celda>{formatoMoneda(s.fondoInicial)}</Celda>
                <Celda>{formatoMoneda(s.saldoEsperado)}</Celda>
                <Celda>{formatoMoneda(s.saldoReal)}</Celda>
                <Celda>{formatoMoneda(s.diferencia)}</Celda>
                <Celda>{new Date(s.cerradaEn).toLocaleString()}</Celda>
              </Fila>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}

export default ReportesPage;
