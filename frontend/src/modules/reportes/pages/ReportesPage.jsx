import { useEffect, useState } from 'react';
import { Download, Mail } from 'lucide-react';
import {
  reporteVentas,
  reporteArticulosMasVendidos,
  reporteUtilidad,
  reporteVentasPorCliente,
  reporteIvaTrasladado,
  reporteKardex,
  reporteProductosSinMovimiento,
  reporteInventarioValorizado,
  reporteCompras,
  reporteCaja,
  enviarReportePorCorreo,
} from '../api/reportes.api';
import { listarSucursales, listarUsuarios } from '../../core/api/core.api';
import { listarClientes } from '../../clientes/api/clientes.api';
import { listarCategorias, listarArticulos } from '../../catalogo/api/catalogo.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import EnviarCorreoModal from '../../../shared/ui/EnviarCorreoModal';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { formatoMoneda } from '../../../shared/format';
import { exportarCsv, construirCsv } from '../../../shared/csv';

// Botón "Exportar CSV" reusado en cada Card de reporte (via el prop `action` de Card) — cada
// reporte exporta exactamente las filas de la tabla que tiene abajo, no un volcado aparte ni
// las cifras resumen que están arriba de la tabla (subtotal/impuestos/etc.), para que lo que
// se descarga coincida 1:1 con lo que se está viendo.
function BotonExportar({ nombreArchivo, filas, columnas }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => exportarCsv(nombreArchivo, filas, columnas)}
      disabled={filas.length === 0}
    >
      <Download size={16} /> Exportar CSV
    </Button>
  );
}

// Reusa exactamente las mismas filas/columnas que BotonExportar (arriba) — el envío por correo
// manda el mismo CSV que se descargaría, nunca un volcado aparte. El armado real del adjunto
// (base64) vive en la página, acá solo se abre el modal con los datos de este reporte.
function BotonEnviarCorreo({
  nombreArchivo, filas, columnas, asunto, onAbrir,
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => onAbrir({
        nombreArchivo, filas, columnas, asunto,
      })}
      disabled={filas.length === 0}
    >
      <Mail size={16} /> Enviar por correo
    </Button>
  );
}

const REPORTES = {
  ventas: {
    etiqueta: 'Ventas por período', fn: reporteVentas, usaFechas: true, usaSucursal: true, usaUsuario: true, usaCliente: true,
  },
  articulos: {
    etiqueta: 'Artículos más vendidos', fn: reporteArticulosMasVendidos, usaFechas: true, usaSucursal: true, usaUsuario: true, usaCliente: true, usaCategoria: true, usaTipo: true,
  },
  utilidad: {
    etiqueta: 'Utilidad de ventas', fn: reporteUtilidad, usaFechas: true, usaSucursal: true,
  },
  ventasPorCliente: {
    etiqueta: 'Ventas por cliente', fn: reporteVentasPorCliente, usaFechas: true, usaSucursal: true,
  },
  iva: {
    etiqueta: 'IVA trasladado', fn: reporteIvaTrasladado, usaFechas: true, usaCliente: true,
  },
  kardex: {
    etiqueta: 'Kardex por artículo', fn: reporteKardex, usaFechas: true, usaSucursal: true, usaArticulo: true,
  },
  sinMovimiento: {
    etiqueta: 'Productos sin movimiento', fn: reporteProductosSinMovimiento, usaDias: true, usaCategoria: true,
  },
  inventario: { etiqueta: 'Inventario valorizado', fn: reporteInventarioValorizado, usaFechas: false, usaSucursal: true },
  compras: { etiqueta: 'Compras por proveedor', fn: reporteCompras, usaFechas: true, usaSucursal: true },
  caja: {
    etiqueta: 'Cortes de caja', fn: reporteCaja, usaFechas: true, usaSucursal: false, usaUsuario: true,
  },
};

const TIPOS_ARTICULO = [
  { valor: '', etiqueta: 'Todos los tipos' },
  { valor: 'PRODUCTO', etiqueta: 'Solo productos' },
  { valor: 'SERVICIO', etiqueta: 'Solo servicios' },
];

function fechaISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function calcularPreset(nombre) {
  const hoy = new Date();
  if (nombre === 'hoy') return { desde: fechaISO(hoy), hasta: fechaISO(hoy) };
  if (nombre === 'ayer') {
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    return { desde: fechaISO(ayer), hasta: fechaISO(ayer) };
  }
  if (nombre === 'semana') {
    const inicio = new Date(hoy);
    const diaSemana = inicio.getDay();
    // getDay(): 0 = domingo. La semana arranca en lunes, así que domingo retrocede 6 días.
    inicio.setDate(inicio.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
    return { desde: fechaISO(inicio), hasta: fechaISO(hoy) };
  }
  if (nombre === 'mes') {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { desde: fechaISO(inicio), hasta: fechaISO(hoy) };
  }
  return { desde: '', hasta: '' };
}

const PRESETS_FECHA = [
  { clave: 'hoy', etiqueta: 'Hoy' },
  { clave: 'ayer', etiqueta: 'Ayer' },
  { clave: 'semana', etiqueta: 'Esta semana' },
  { clave: 'mes', etiqueta: 'Este mes' },
];

function ReportesPage() {
  const [tipo, setTipo] = useState('ventas');
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioId, setUsuarioId] = useState('');
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [categoriaId, setCategoriaId] = useState('');
  const [tipoArticulo, setTipoArticulo] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [articuloId, setArticuloId] = useState('');
  const [dias, setDias] = useState('30');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const [envioDatos, setEnvioDatos] = useState(null);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [errorEnvioCorreo, setErrorEnvioCorreo] = useState('');
  const [exitoEnvioCorreo, setExitoEnvioCorreo] = useState('');

  useEffect(() => {
    listarSucursales().then(setSucursales).catch(() => {});
    listarUsuarios().then((lista) => setUsuarios(lista.filter((u) => u.activo))).catch(() => {});
    listarClientes().then((lista) => setClientes(lista.filter((c) => c.activo))).catch(() => {});
    listarCategorias().then(setCategorias).catch(() => {});
    listarArticulos().then((lista) => setArticulos(lista.filter((a) => a.activo && a.tipo === 'PRODUCTO'))).catch(() => {});
  }, []);

  const config = REPORTES[tipo];

  async function generar(e) {
    e.preventDefault();
    setError('');
    setResultado(null);
    if (config.usaArticulo && !articuloId) {
      setError('Elegí un artículo para ver su Kardex.');
      return;
    }
    try {
      const params = {};
      if (config.usaFechas) {
        if (desde) params.desde = desde;
        if (hasta) params.hasta = hasta;
      }
      if (config.usaSucursal && sucursalId) params.sucursalId = sucursalId;
      if (config.usaUsuario && usuarioId) params.usuarioId = usuarioId;
      if (config.usaCliente && clienteId) params.clienteId = clienteId;
      if (config.usaCategoria && categoriaId) params.categoriaId = categoriaId;
      if (config.usaTipo && tipoArticulo) params.tipo = tipoArticulo;
      if (config.usaArticulo && articuloId) params.articuloId = articuloId;
      if (config.usaDias && dias) params.dias = dias;
      const data = await config.fn(params);
      setResultado(data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo generar el reporte.');
    }
  }

  function abrirEnvioReporte(datos) {
    setErrorEnvioCorreo('');
    setExitoEnvioCorreo('');
    setEnvioDatos(datos);
  }

  function cerrarEnvioReporte() {
    setEnvioDatos(null);
  }

  // El CSV emailado es el mismo que produce exportarCsv (mismo BOM UTF-8 para que los acentos
  // se vean bien en Excel) — solo cambia el destino final (adjunto de correo vs. descarga).
  async function enviarCorreoReporte(destinatario, asunto, mensaje) {
    setEnviandoCorreo(true);
    setErrorEnvioCorreo('');
    try {
      const contenido = `﻿${construirCsv(envioDatos.filas, envioDatos.columnas)}`;
      const base64 = btoa(unescape(encodeURIComponent(contenido)));
      await enviarReportePorCorreo({
        destinatario, asunto, mensaje, adjuntoBase64: base64, nombreArchivo: envioDatos.nombreArchivo,
      });
      setExitoEnvioCorreo(`Reporte enviado a ${destinatario}.`);
      cerrarEnvioReporte();
    } catch (err) {
      setErrorEnvioCorreo(err.response?.data?.error || 'No se pudo enviar el correo.');
    } finally {
      setEnviandoCorreo(false);
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
          {config.usaUsuario && (
            <Select id="usuarioReporte" label="Usuario / Cajero" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} className="min-w-[180px]">
              <option value="">Todos los usuarios</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </Select>
          )}
          {config.usaCliente && (
            <Select id="clienteReporte" label="Cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="min-w-[180px]">
              <option value="">Todos los clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </Select>
          )}
          {config.usaCategoria && (
            <Select id="categoriaReporte" label="Categoría" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="min-w-[180px]">
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </Select>
          )}
          {config.usaTipo && (
            <Select id="tipoArticuloReporte" label="Tipo" value={tipoArticulo} onChange={(e) => setTipoArticulo(e.target.value)} className="min-w-[160px]">
              {TIPOS_ARTICULO.map((t) => (
                <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
              ))}
            </Select>
          )}
          {config.usaArticulo && (
            <Select id="articuloReporte" label="Artículo" value={articuloId} onChange={(e) => setArticuloId(e.target.value)} className="min-w-[220px]">
              <option value="">Elegí un artículo…</option>
              {articulos.map((a) => (
                <option key={a.id} value={a.id}>{a.sku ? `${a.sku} — ${a.nombre}` : a.nombre}</option>
              ))}
            </Select>
          )}
          {config.usaDias && (
            <Input id="diasReporte" label="Días sin movimiento" type="number" min="1" value={dias} onChange={(e) => setDias(e.target.value)} className="w-40" />
          )}
          <Button type="submit">Generar</Button>
        </form>
        {config.usaFechas && (
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS_FECHA.map((p) => (
              <Button
                key={p.clave}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const { desde: d, hasta: h } = calcularPreset(p.clave);
                  setDesde(d);
                  setHasta(h);
                }}
              >
                {p.etiqueta}
              </Button>
            ))}
          </div>
        )}
      </Card>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
      {exitoEnvioCorreo && <p className="rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">{exitoEnvioCorreo}</p>}

      {resultado && tipo === 'ventas' && (
        <Card
          title="Ventas por período"
          action={(
            <div className="flex flex-wrap gap-2">
              <BotonExportar
                nombreArchivo="ventas-por-metodo-pago.csv"
                filas={resultado.porMetodoPago.map((p) => ({ metodo: p.metodo, monto: Number(p.monto) }))}
                columnas={[{ clave: 'metodo', label: 'Método' }, { clave: 'monto', label: 'Monto' }]}
              />
              <BotonEnviarCorreo
                nombreArchivo="ventas-por-metodo-pago.csv"
                filas={resultado.porMetodoPago.map((p) => ({ metodo: p.metodo, monto: Number(p.monto) }))}
                columnas={[{ clave: 'metodo', label: 'Método' }, { clave: 'monto', label: 'Monto' }]}
                asunto="Reporte — Ventas por período"
                onAbrir={abrirEnvioReporte}
              />
            </div>
          )}
        >
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
        <Card
          title="Artículos más vendidos"
          action={(
            <div className="flex flex-wrap gap-2">
              <BotonExportar
                nombreArchivo="articulos-mas-vendidos.csv"
                filas={resultado.map((r) => ({
                  codigo: r.articulo?.sku,
                  articulo: r.articulo?.nombre,
                  cantidad: Number(r.cantidad),
                  monto: Number(r.monto),
                  utilidad: r.utilidad === null ? 'N/D' : Number(r.utilidad),
                }))}
                columnas={[
                  { clave: 'codigo', label: 'Código' },
                  { clave: 'articulo', label: 'Artículo' },
                  { clave: 'cantidad', label: 'Cantidad' },
                  { clave: 'monto', label: 'Monto' },
                  { clave: 'utilidad', label: 'Utilidad' },
                ]}
              />
              <BotonEnviarCorreo
                nombreArchivo="articulos-mas-vendidos.csv"
                filas={resultado.map((r) => ({
                  codigo: r.articulo?.sku,
                  articulo: r.articulo?.nombre,
                  cantidad: Number(r.cantidad),
                  monto: Number(r.monto),
                  utilidad: r.utilidad === null ? 'N/D' : Number(r.utilidad),
                }))}
                columnas={[
                  { clave: 'codigo', label: 'Código' },
                  { clave: 'articulo', label: 'Artículo' },
                  { clave: 'cantidad', label: 'Cantidad' },
                  { clave: 'monto', label: 'Monto' },
                  { clave: 'utilidad', label: 'Utilidad' },
                ]}
                asunto="Reporte — Artículos más vendidos"
                onAbrir={abrirEnvioReporte}
              />
            </div>
          )}
        >
          <p className="mb-4 text-xs text-gray-500">
            "Utilidad" es N/D cuando el artículo tiene ventas de antes de que el sistema empezara a
            registrar el costo por línea — no se aproxima con el costo de hoy.
          </p>
          <Table columnas={['Código', 'Artículo', 'Cantidad', 'Monto', 'Utilidad']}>
            {resultado.length === 0 && <TablaVacia colSpan={5} />}
            {resultado.map((r) => (
              <Fila key={r.articulo?.id}>
                <Celda className="text-gray-500">{r.articulo?.sku || '—'}</Celda>
                <Celda className="font-medium text-gray-800">{r.articulo?.nombre}</Celda>
                <Celda>{r.cantidad}</Celda>
                <Celda>{formatoMoneda(r.monto)}</Celda>
                <Celda>{r.utilidad === null ? <span className="text-gray-400">N/D</span> : formatoMoneda(r.utilidad)}</Celda>
              </Fila>
            ))}
          </Table>
        </Card>
      )}

      {resultado && tipo === 'utilidad' && (
        <Card
          title="Utilidad de ventas"
          action={(
            <div className="flex flex-wrap gap-2">
              <BotonExportar
                nombreArchivo="utilidad-de-ventas.csv"
                filas={[{
                  venta: Number(resultado.venta),
                  costo: Number(resultado.costo),
                  ganancia: Number(resultado.ganancia),
                }]}
                columnas={[
                  { clave: 'venta', label: 'Venta' },
                  { clave: 'costo', label: 'Costo' },
                  { clave: 'ganancia', label: 'Ganancia' },
                ]}
              />
              <BotonEnviarCorreo
                nombreArchivo="utilidad-de-ventas.csv"
                filas={[{
                  venta: Number(resultado.venta),
                  costo: Number(resultado.costo),
                  ganancia: Number(resultado.ganancia),
                }]}
                columnas={[
                  { clave: 'venta', label: 'Venta' },
                  { clave: 'costo', label: 'Costo' },
                  { clave: 'ganancia', label: 'Ganancia' },
                ]}
                asunto="Reporte — Utilidad de ventas"
                onAbrir={abrirEnvioReporte}
              />
            </div>
          )}
        >
          {resultado.lineasSinCosto > 0 && (
            <p className="mb-4 rounded-lg bg-warning-50 px-4 py-2.5 text-sm text-warning-700">
              {resultado.lineasSinCosto} de {resultado.lineasTotales} línea(s) vendida(s) en este rango
              son de antes de que el sistema registrara el costo por venta — la Ganancia no las incluye
              (el Venta total sí, para que no falte facturación en el número de arriba).
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">Venta</p>
              <p className="text-lg font-semibold text-gray-900">{formatoMoneda(resultado.venta)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Costo</p>
              <p className="text-lg font-semibold text-gray-900">{formatoMoneda(resultado.costo)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Ganancia</p>
              <p className="text-lg font-semibold text-primary-700">{formatoMoneda(resultado.ganancia)}</p>
            </div>
          </div>
        </Card>
      )}

      {resultado && tipo === 'iva' && (
        <Card
          title="IVA trasladado"
          action={(
            <div className="flex flex-wrap gap-2">
              <BotonExportar
                nombreArchivo="iva-trasladado.csv"
                filas={resultado.porTasa.map((p) => ({
                  tasa: `${(p.tasa * 100).toFixed(0)}%`,
                  baseGravable: Number(p.baseGravable),
                  impuesto: Number(p.impuesto),
                }))}
                columnas={[
                  { clave: 'tasa', label: 'Tasa' },
                  { clave: 'baseGravable', label: 'Base gravable' },
                  { clave: 'impuesto', label: 'Impuesto' },
                ]}
              />
              <BotonEnviarCorreo
                nombreArchivo="iva-trasladado.csv"
                filas={resultado.porTasa.map((p) => ({
                  tasa: `${(p.tasa * 100).toFixed(0)}%`,
                  baseGravable: Number(p.baseGravable),
                  impuesto: Number(p.impuesto),
                }))}
                columnas={[
                  { clave: 'tasa', label: 'Tasa' },
                  { clave: 'baseGravable', label: 'Base gravable' },
                  { clave: 'impuesto', label: 'Impuesto' },
                ]}
                asunto="Reporte — IVA trasladado"
                onAbrir={abrirEnvioReporte}
              />
            </div>
          )}
        >
          <p className="mb-4 text-sm text-gray-500">
            Base gravable: <span className="font-semibold text-gray-900">{formatoMoneda(resultado.baseGravable)}</span>
            {' · '}Impuesto trasladado: <span className="font-semibold text-gray-900">{formatoMoneda(resultado.impuesto)}</span>
          </p>
          <Table columnas={['Tasa', 'Base gravable', 'Impuesto']}>
            {resultado.porTasa.length === 0 && <TablaVacia colSpan={3} />}
            {resultado.porTasa.map((p) => (
              <Fila key={p.tasa}>
                <Celda className="font-medium text-gray-800">{(p.tasa * 100).toFixed(0)}%</Celda>
                <Celda>{formatoMoneda(p.baseGravable)}</Celda>
                <Celda>{formatoMoneda(p.impuesto)}</Celda>
              </Fila>
            ))}
          </Table>
        </Card>
      )}

      {resultado && tipo === 'kardex' && (
        <Card
          title={`Kardex — ${resultado.articulo.nombre}`}
          action={(
            <div className="flex flex-wrap gap-2">
              <BotonExportar
                nombreArchivo="kardex.csv"
                filas={resultado.movimientos.map((m) => ({
                  fecha: new Date(m.creadoEn).toLocaleString(),
                  documento: m.documento,
                  entrada: Number(m.entrada),
                  salida: Number(m.salida),
                  existencia: Number(m.existencia),
                  costo: Number(m.costo),
                }))}
                columnas={[
                  { clave: 'fecha', label: 'Fecha' },
                  { clave: 'documento', label: 'Documento' },
                  { clave: 'entrada', label: 'Entrada' },
                  { clave: 'salida', label: 'Salida' },
                  { clave: 'existencia', label: 'Existencia' },
                  { clave: 'costo', label: 'Costo (actual)' },
                ]}
              />
              <BotonEnviarCorreo
                nombreArchivo="kardex.csv"
                filas={resultado.movimientos.map((m) => ({
                  fecha: new Date(m.creadoEn).toLocaleString(),
                  documento: m.documento,
                  entrada: Number(m.entrada),
                  salida: Number(m.salida),
                  existencia: Number(m.existencia),
                  costo: Number(m.costo),
                }))}
                columnas={[
                  { clave: 'fecha', label: 'Fecha' },
                  { clave: 'documento', label: 'Documento' },
                  { clave: 'entrada', label: 'Entrada' },
                  { clave: 'salida', label: 'Salida' },
                  { clave: 'existencia', label: 'Existencia' },
                  { clave: 'costo', label: 'Costo (actual)' },
                ]}
                asunto={`Reporte — Kardex ${resultado.articulo.nombre}`}
                onAbrir={abrirEnvioReporte}
              />
            </div>
          )}
        >
          <p className="mb-4 text-xs text-gray-500">
            "Costo" es el costo actual del artículo, no uno histórico por movimiento. Máximo 200 renglones.
          </p>
          <Table columnas={['Fecha', 'Documento', 'Entrada', 'Salida', 'Existencia', 'Costo (actual)']}>
            {resultado.movimientos.length === 0 && <TablaVacia colSpan={6} />}
            {resultado.movimientos.map((m) => (
              <Fila key={m.id}>
                <Celda>{new Date(m.creadoEn).toLocaleString()}</Celda>
                <Celda className="font-medium text-gray-800">{m.documento}</Celda>
                <Celda>{m.entrada > 0 ? m.entrada : '—'}</Celda>
                <Celda>{m.salida > 0 ? m.salida : '—'}</Celda>
                <Celda>{m.existencia}</Celda>
                <Celda>{formatoMoneda(m.costo)}</Celda>
              </Fila>
            ))}
          </Table>
        </Card>
      )}

      {resultado && tipo === 'ventasPorCliente' && (
        <Card
          title="Ventas por cliente"
          action={(
            <div className="flex flex-wrap gap-2">
              <BotonExportar
                nombreArchivo="ventas-por-cliente.csv"
                filas={resultado.map((r) => ({
                  cliente: r.cliente?.nombre,
                  compras: Number(r.numeroVentas),
                  total: Number(r.total),
                  devoluciones: Number(r.totalDevoluciones),
                  neto: Number(r.totalNeto),
                }))}
                columnas={[
                  { clave: 'cliente', label: 'Cliente' },
                  { clave: 'compras', label: 'N° de compras' },
                  { clave: 'total', label: 'Total' },
                  { clave: 'devoluciones', label: 'Devoluciones' },
                  { clave: 'neto', label: 'Neto' },
                ]}
              />
              <BotonEnviarCorreo
                nombreArchivo="ventas-por-cliente.csv"
                filas={resultado.map((r) => ({
                  cliente: r.cliente?.nombre,
                  compras: Number(r.numeroVentas),
                  total: Number(r.total),
                  devoluciones: Number(r.totalDevoluciones),
                  neto: Number(r.totalNeto),
                }))}
                columnas={[
                  { clave: 'cliente', label: 'Cliente' },
                  { clave: 'compras', label: 'N° de compras' },
                  { clave: 'total', label: 'Total' },
                  { clave: 'devoluciones', label: 'Devoluciones' },
                  { clave: 'neto', label: 'Neto' },
                ]}
                asunto="Reporte — Ventas por cliente"
                onAbrir={abrirEnvioReporte}
              />
            </div>
          )}
        >
          <Table columnas={['Cliente', 'N° de compras', 'Total', 'Devoluciones', 'Neto']}>
            {resultado.length === 0 && <TablaVacia colSpan={5} />}
            {resultado.map((r) => (
              <Fila key={r.cliente?.id}>
                <Celda className="font-medium text-gray-800">{r.cliente?.nombre || '—'}</Celda>
                <Celda>{r.numeroVentas}</Celda>
                <Celda>{formatoMoneda(r.total)}</Celda>
                <Celda>{formatoMoneda(r.totalDevoluciones)}</Celda>
                <Celda>{formatoMoneda(r.totalNeto)}</Celda>
              </Fila>
            ))}
          </Table>
        </Card>
      )}

      {resultado && tipo === 'sinMovimiento' && (
        <Card
          title="Productos sin movimiento"
          action={(
            <div className="flex flex-wrap gap-2">
              <BotonExportar
                nombreArchivo="productos-sin-movimiento.csv"
                filas={resultado.map((r) => ({
                  codigo: r.articulo.sku,
                  articulo: r.articulo.nombre,
                  ultimoMovimiento: r.ultimoMovimiento ? new Date(r.ultimoMovimiento).toLocaleDateString() : 'Nunca',
                }))}
                columnas={[
                  { clave: 'codigo', label: 'Código' },
                  { clave: 'articulo', label: 'Artículo' },
                  { clave: 'ultimoMovimiento', label: 'Último movimiento' },
                ]}
              />
              <BotonEnviarCorreo
                nombreArchivo="productos-sin-movimiento.csv"
                filas={resultado.map((r) => ({
                  codigo: r.articulo.sku,
                  articulo: r.articulo.nombre,
                  ultimoMovimiento: r.ultimoMovimiento ? new Date(r.ultimoMovimiento).toLocaleDateString() : 'Nunca',
                }))}
                columnas={[
                  { clave: 'codigo', label: 'Código' },
                  { clave: 'articulo', label: 'Artículo' },
                  { clave: 'ultimoMovimiento', label: 'Último movimiento' },
                ]}
                asunto="Reporte — Productos sin movimiento"
                onAbrir={abrirEnvioReporte}
              />
            </div>
          )}
        >
          <Table columnas={['Código', 'Artículo', 'Último movimiento']}>
            {resultado.length === 0 && <TablaVacia colSpan={3} />}
            {resultado.map((r) => (
              <Fila key={r.articulo.id}>
                <Celda className="text-gray-500">{r.articulo.sku || '—'}</Celda>
                <Celda className="font-medium text-gray-800">{r.articulo.nombre}</Celda>
                <Celda>{r.ultimoMovimiento ? new Date(r.ultimoMovimiento).toLocaleDateString() : 'Nunca'}</Celda>
              </Fila>
            ))}
          </Table>
        </Card>
      )}

      {resultado && tipo === 'inventario' && (
        <>
          <Card
            title="Inventario valorizado"
            action={(
              <div className="flex flex-wrap gap-2">
                <BotonExportar
                  nombreArchivo="inventario-valorizado.csv"
                  filas={resultado.porSucursal.map((s) => ({ sucursal: s.sucursal.nombre, valor: Number(s.valor) }))}
                  columnas={[{ clave: 'sucursal', label: 'Sucursal' }, { clave: 'valor', label: 'Valor' }]}
                />
                <BotonEnviarCorreo
                  nombreArchivo="inventario-valorizado.csv"
                  filas={resultado.porSucursal.map((s) => ({ sucursal: s.sucursal.nombre, valor: Number(s.valor) }))}
                  columnas={[{ clave: 'sucursal', label: 'Sucursal' }, { clave: 'valor', label: 'Valor' }]}
                  asunto="Reporte — Inventario valorizado"
                  onAbrir={abrirEnvioReporte}
                />
              </div>
            )}
          >
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
          <Card
            title="Stock bajo"
            action={(
              <div className="flex flex-wrap gap-2">
                <BotonExportar
                  nombreArchivo="stock-bajo.csv"
                  filas={resultado.stockBajo.map((r) => ({
                    articulo: r.articulo.nombre,
                    sucursal: r.sucursal.nombre,
                    cantidad: Number(r.cantidad),
                    minimo: Number(r.stockMinimo),
                  }))}
                  columnas={[
                    { clave: 'articulo', label: 'Artículo' },
                    { clave: 'sucursal', label: 'Sucursal' },
                    { clave: 'cantidad', label: 'Cantidad' },
                    { clave: 'minimo', label: 'Mínimo' },
                  ]}
                />
                <BotonEnviarCorreo
                  nombreArchivo="stock-bajo.csv"
                  filas={resultado.stockBajo.map((r) => ({
                    articulo: r.articulo.nombre,
                    sucursal: r.sucursal.nombre,
                    cantidad: Number(r.cantidad),
                    minimo: Number(r.stockMinimo),
                  }))}
                  columnas={[
                    { clave: 'articulo', label: 'Artículo' },
                    { clave: 'sucursal', label: 'Sucursal' },
                    { clave: 'cantidad', label: 'Cantidad' },
                    { clave: 'minimo', label: 'Mínimo' },
                  ]}
                  asunto="Reporte — Stock bajo"
                  onAbrir={abrirEnvioReporte}
                />
              </div>
            )}
          >
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
        <Card
          title="Compras por proveedor"
          action={(
            <div className="flex flex-wrap gap-2">
              <BotonExportar
                nombreArchivo="compras-por-proveedor.csv"
                filas={resultado.porProveedor.map((p) => ({
                  proveedor: p.proveedor.nombre,
                  total: Number(p.total),
                  compras: Number(p.numeroCompras),
                }))}
                columnas={[
                  { clave: 'proveedor', label: 'Proveedor' },
                  { clave: 'total', label: 'Total' },
                  { clave: 'compras', label: 'Compras' },
                ]}
              />
              <BotonEnviarCorreo
                nombreArchivo="compras-por-proveedor.csv"
                filas={resultado.porProveedor.map((p) => ({
                  proveedor: p.proveedor.nombre,
                  total: Number(p.total),
                  compras: Number(p.numeroCompras),
                }))}
                columnas={[
                  { clave: 'proveedor', label: 'Proveedor' },
                  { clave: 'total', label: 'Total' },
                  { clave: 'compras', label: 'Compras' },
                ]}
                asunto="Reporte — Compras por proveedor"
                onAbrir={abrirEnvioReporte}
              />
            </div>
          )}
        >
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
        <Card
          title="Cortes de caja"
          action={(
            <div className="flex flex-wrap gap-2">
              <BotonExportar
                nombreArchivo="cortes-de-caja.csv"
                filas={resultado.sesiones.map((s) => ({
                  caja: s.caja?.nombre,
                  cajero: s.cajero?.nombre,
                  fondo: Number(s.fondoInicial),
                  ingresos: Number(s.movimientos.ingreso),
                  ventas: Number(s.movimientos.venta),
                  retiros: Number(s.movimientos.retiro),
                  devoluciones: Number(s.movimientos.devolucion),
                  esperado: Number(s.saldoEsperado),
                  real: Number(s.saldoReal),
                  diferencia: Number(s.diferencia),
                  cerrada: new Date(s.cerradaEn).toLocaleString(),
                }))}
                columnas={[
                  { clave: 'caja', label: 'Caja' },
                  { clave: 'cajero', label: 'Cajero' },
                  { clave: 'fondo', label: 'Fondo' },
                  { clave: 'ingresos', label: 'Ingresos' },
                  { clave: 'ventas', label: 'Ventas' },
                  { clave: 'retiros', label: 'Retiros' },
                  { clave: 'devoluciones', label: 'Devoluciones' },
                  { clave: 'esperado', label: 'Esperado' },
                  { clave: 'real', label: 'Real' },
                  { clave: 'diferencia', label: 'Diferencia' },
                  { clave: 'cerrada', label: 'Cerrada' },
                ]}
              />
              <BotonEnviarCorreo
                nombreArchivo="cortes-de-caja.csv"
                filas={resultado.sesiones.map((s) => ({
                  caja: s.caja?.nombre,
                  cajero: s.cajero?.nombre,
                  fondo: Number(s.fondoInicial),
                  ingresos: Number(s.movimientos.ingreso),
                  ventas: Number(s.movimientos.venta),
                  retiros: Number(s.movimientos.retiro),
                  devoluciones: Number(s.movimientos.devolucion),
                  esperado: Number(s.saldoEsperado),
                  real: Number(s.saldoReal),
                  diferencia: Number(s.diferencia),
                  cerrada: new Date(s.cerradaEn).toLocaleString(),
                }))}
                columnas={[
                  { clave: 'caja', label: 'Caja' },
                  { clave: 'cajero', label: 'Cajero' },
                  { clave: 'fondo', label: 'Fondo' },
                  { clave: 'ingresos', label: 'Ingresos' },
                  { clave: 'ventas', label: 'Ventas' },
                  { clave: 'retiros', label: 'Retiros' },
                  { clave: 'devoluciones', label: 'Devoluciones' },
                  { clave: 'esperado', label: 'Esperado' },
                  { clave: 'real', label: 'Real' },
                  { clave: 'diferencia', label: 'Diferencia' },
                  { clave: 'cerrada', label: 'Cerrada' },
                ]}
                asunto="Reporte — Cortes de caja"
                onAbrir={abrirEnvioReporte}
              />
            </div>
          )}
        >
          <p className="mb-4 text-sm text-gray-500">
            Diferencia acumulada: <span className="font-semibold text-gray-900">{formatoMoneda(resultado.totalDiferencias)}</span>
          </p>
          <Table columnas={['Caja', 'Cajero', 'Fondo', 'Ingresos', 'Ventas', 'Retiros', 'Devoluciones', 'Esperado', 'Real', 'Diferencia', 'Cerrada']}>
            {resultado.sesiones.length === 0 && <TablaVacia colSpan={11} />}
            {resultado.sesiones.map((s) => (
              <Fila key={s.id}>
                <Celda className="font-medium text-gray-800">{s.caja?.nombre}</Celda>
                <Celda>{s.cajero?.nombre || '—'}</Celda>
                <Celda>{formatoMoneda(s.fondoInicial)}</Celda>
                <Celda>{formatoMoneda(s.movimientos.ingreso)}</Celda>
                <Celda>{formatoMoneda(s.movimientos.venta)}</Celda>
                <Celda>{formatoMoneda(s.movimientos.retiro)}</Celda>
                <Celda>{formatoMoneda(s.movimientos.devolucion)}</Celda>
                <Celda>{formatoMoneda(s.saldoEsperado)}</Celda>
                <Celda>{formatoMoneda(s.saldoReal)}</Celda>
                <Celda>{formatoMoneda(s.diferencia)}</Celda>
                <Celda>{new Date(s.cerradaEn).toLocaleString()}</Celda>
              </Fila>
            ))}
          </Table>
        </Card>
      )}

      <EnviarCorreoModal
        abierto={envioDatos !== null}
        onCerrar={cerrarEnvioReporte}
        titulo="Enviar reporte por correo"
        asuntoSugerido={envioDatos?.asunto || ''}
        enviando={enviandoCorreo}
        error={errorEnvioCorreo}
        onEnviar={enviarCorreoReporte}
      />
    </div>
  );
}

export default ReportesPage;
