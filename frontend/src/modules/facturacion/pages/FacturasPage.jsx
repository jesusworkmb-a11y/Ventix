import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  listarFacturas, obtenerFactura, cancelarFactura, timbrarFactura,
} from '../api/facturas.api';
import { generarPdfFactura } from '../pdf/facturaPdf';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';
import Modal from '../../../shared/ui/Modal';
import Paginacion from '../../../shared/ui/Paginacion';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { formatoMoneda, formatoFecha } from '../../../shared/format';
import { useAuth } from '../../../shared/context/AuthContext';

const COLUMNAS = [
  { label: 'Folio', clave: 'folio', ordenable: true },
  { label: 'Tipo', clave: 'tipo', ordenable: true },
  { label: 'Receptor', clave: null },
  { label: 'Total', clave: 'total', ordenable: true },
  { label: 'Estado', clave: 'estado', ordenable: true },
  { label: '', clave: null },
];

const TIPO_LABEL = {
  DIRECTA: 'Directa',
  VENTA_POS: 'Venta POS',
  AUTOFACTURACION: 'Autofacturación',
  GLOBAL: 'Global',
  CONSOLIDADA_CLIENTE: 'Consolidada',
};

const ESTADO_TONO = {
  BORRADOR: 'gray', PENDIENTE: 'warning', TIMBRADA: 'success', CANCELADA: 'gray', ERROR: 'danger',
};

const MOTIVOS_CANCELACION = [
  { value: '01', label: '01 — Comprobante con errores con relación' },
  { value: '02', label: '02 — Comprobante con errores sin relación' },
  { value: '03', label: '03 — No se llevó a cabo la operación' },
  { value: '04', label: '04 — Operación nominativa en factura global' },
];

function FacturasPage() {
  const { permisos, empresa } = useAuth();
  const [facturas, setFacturas] = useState([]);
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [orden, setOrden] = useState({ ordenarPor: 'creadoEn', orden: 'desc' });
  const [error, setError] = useState('');

  const [detalleId, setDetalleId] = useState(null);
  const [detalle, setDetalle] = useState(null);

  const [cancelandoId, setCancelandoId] = useState(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState('03');
  const [facturaSustitutaId, setFacturaSustitutaId] = useState('');
  const [errorCancelar, setErrorCancelar] = useState('');
  const [timbrandoId, setTimbrandoId] = useState(null);
  const [generandoPdfId, setGenerandoPdfId] = useState(null);

  const puedeCrear = permisos?.includes('facturacion.crear');
  const puedeGlobal = permisos?.includes('facturacion.global.generar');
  const puedeCancelar = permisos?.includes('facturacion.cancelar');

  function cargar(pagina = 1) {
    listarFacturas({
      buscar: busqueda || undefined,
      tipo: tipo || undefined,
      estado: estado || undefined,
      pagina,
      porPagina: 20,
      ordenarPor: orden.ordenarPor,
      orden: orden.orden,
    })
      .then((r) => {
        setFacturas(r.datos);
        setPaginacion({ pagina: r.pagina, totalPaginas: r.totalPaginas, total: r.total });
      })
      .catch(() => {});
  }

  useEffect(() => {
    cargar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, tipo, estado, orden]);

  function handleOrdenar(clave) {
    setOrden((o) => (o.ordenarPor === clave
      ? { ordenarPor: clave, orden: o.orden === 'asc' ? 'desc' : 'asc' }
      : { ordenarPor: clave, orden: 'asc' }));
  }

  async function abrirDetalle(id) {
    setError('');
    setDetalle(null);
    setDetalleId(id);
    try {
      const f = await obtenerFactura(id);
      setDetalle(f);
    } catch (err) {
      setError('No se pudo cargar el detalle de la factura.');
      setDetalleId(null);
    }
  }

  function abrirCancelar(id) {
    setErrorCancelar('');
    setMotivoCancelacion('03');
    setFacturaSustitutaId('');
    setCancelandoId(id);
  }

  async function confirmarCancelar(e) {
    e.preventDefault();
    setErrorCancelar('');
    try {
      await cancelarFactura(cancelandoId, {
        claveMotivoCancelacion: motivoCancelacion,
        facturaSustitutaId: motivoCancelacion === '01' ? facturaSustitutaId : undefined,
      });
      setCancelandoId(null);
      cargar(paginacion.pagina);
    } catch (err) {
      setErrorCancelar(err.response?.data?.error || 'No se pudo cancelar la factura.');
    }
  }

  async function reintentarTimbrado(id) {
    setError('');
    setTimbrandoId(id);
    try {
      const factura = await timbrarFactura(id);
      if (factura.errorTimbrado) setError(factura.errorTimbrado);
      cargar(paginacion.pagina);
      if (detalleId === id) setDetalle(factura);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo timbrar la factura.');
    } finally {
      setTimbrandoId(null);
    }
  }

  // El XML timbrado ya viaja completo (base64) dentro de la Factura -- no hace falta un
  // endpoint aparte, se arma el archivo y se dispara la descarga directo en el navegador.
  function descargarXml(f) {
    const binario = atob(f.xmlTimbrado);
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${f.folio}.xml`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Representación impresa del CFDI (plantilla elegida en Configuración de Empresa) — a
  // diferencia del XML, que ya viaja completo en la Factura, el PDF se arma en el momento
  // porque incluye el QR de verificación del SAT (generarPdfFactura es async por eso).
  async function descargarPdf(f) {
    setError('');
    setGenerandoPdfId(f.id);
    try {
      await generarPdfFactura(f, empresa);
    } catch (err) {
      setError('No se pudo generar el PDF de la factura.');
    } finally {
      setGenerandoPdfId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturación</h1>
          <p className="text-sm text-gray-500">Facturas emitidas (CFDI), timbradas ante el SAT.</p>
        </div>
        <div className="flex gap-2">
          {puedeCrear && (
            <Link to="/facturacion/directa">
              <Button variant="secondary">Factura directa</Button>
            </Link>
          )}
          {puedeGlobal && (
            <Link to="/facturacion/global">
              <Button variant="secondary">Global / Consolidada</Button>
            </Link>
          )}
        </div>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative max-w-sm flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por folio, RFC o nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <Select id="filtroTipo" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-44">
            <option value="">Todos</option>
            {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select id="filtroEstado" label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} className="w-40">
            <option value="">Todos</option>
            {Object.keys(ESTADO_TONO).map((v) => <option key={v} value={v}>{v}</option>)}
          </Select>
        </div>
      </Card>

      <Card>
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
          {facturas.length === 0 && <TablaVacia colSpan={6} />}
          {facturas.map((f) => (
            <Fila key={f.id}>
              <Celda className="font-medium text-gray-800">{f.folio}</Celda>
              <Celda>{TIPO_LABEL[f.tipo] || f.tipo}</Celda>
              <Celda>
                <span className="block truncate">{f.nombreReceptor}</span>
                <span className="block text-xs text-gray-400">{f.rfcReceptor}</span>
              </Celda>
              <Celda>{formatoMoneda(f.total)}</Celda>
              <Celda><Badge tono={ESTADO_TONO[f.estado] || 'gray'}>{f.estado}</Badge></Celda>
              <Celda className="text-right">
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => abrirDetalle(f.id)} className="text-sm text-primary-600 hover:underline">
                    Ver
                  </button>
                  {puedeCrear && f.estado === 'ERROR' && (
                    <button
                      type="button"
                      onClick={() => reintentarTimbrado(f.id)}
                      disabled={timbrandoId === f.id}
                      className="text-sm text-primary-600 hover:underline disabled:opacity-50"
                    >
                      {timbrandoId === f.id ? 'Timbrando…' : 'Reintentar timbrado'}
                    </button>
                  )}
                  {puedeCancelar && f.estado !== 'CANCELADA' && (
                    <button type="button" onClick={() => abrirCancelar(f.id)} className="text-sm text-danger-600 hover:underline">
                      Cancelar
                    </button>
                  )}
                </div>
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <Modal abierto={detalleId !== null} onCerrar={() => setDetalleId(null)} titulo="Detalle de factura" ancho="max-w-2xl">
        {!detalle && <p className="text-sm text-gray-500">Cargando…</p>}
        {detalle && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Folio</span><p className="font-medium">{detalle.folio}</p></div>
              <div><span className="text-gray-500">Tipo</span><p className="font-medium">{TIPO_LABEL[detalle.tipo] || detalle.tipo}</p></div>
              <div><span className="text-gray-500">Estado</span><p><Badge tono={ESTADO_TONO[detalle.estado] || 'gray'}>{detalle.estado}</Badge></p></div>
              <div><span className="text-gray-500">Fecha</span><p className="font-medium">{formatoFecha(detalle.creadoEn)}</p></div>
              <div><span className="text-gray-500">Receptor</span><p className="font-medium">{detalle.nombreReceptor} — {detalle.rfcReceptor}</p></div>
              <div><span className="text-gray-500">Emisor</span><p className="font-medium">{detalle.razonSocialEmisor} — {detalle.rfcEmisor}</p></div>
              <div><span className="text-gray-500">Forma / método de pago</span><p className="font-medium">{detalle.formaPago} / {detalle.metodoPago}</p></div>
              <div><span className="text-gray-500">Lugar de expedición</span><p className="font-medium">{detalle.lugarExpedicion}</p></div>
              {detalle.uuid && (
                <div className="col-span-2"><span className="text-gray-500">Folio fiscal (UUID)</span><p className="font-medium">{detalle.uuid}</p></div>
              )}
            </div>

            {detalle.estado === 'ERROR' && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">
                <span>No se pudo timbrar esta factura ante el SAT.</span>
                <Button type="button" size="sm" disabled={timbrandoId === detalle.id} onClick={() => reintentarTimbrado(detalle.id)}>
                  {timbrandoId === detalle.id ? 'Timbrando…' : 'Reintentar timbrado'}
                </Button>
              </div>
            )}

            <Table columnas={['Descripción', 'Cant.', 'V. unitario', 'Importe', 'Impuesto']}>
              {detalle.detalles.map((d) => (
                <Fila key={d.id}>
                  <Celda>{d.descripcion}</Celda>
                  <Celda>{d.cantidad}</Celda>
                  <Celda>{formatoMoneda(d.valorUnitario)}</Celda>
                  <Celda>{formatoMoneda(d.importe)}</Celda>
                  <Celda>
                    {d.impuestos.map((i) => (
                      <span key={i.id} className="block text-xs">
                        {i.tipoFactorSat === 'Exento' ? 'Exento' : `${(Number(i.tasaOCuota) * 100).toFixed(0)}% = ${formatoMoneda(i.importe)}`}
                      </span>
                    ))}
                  </Celda>
                </Fila>
              ))}
            </Table>

            <div className="flex items-center justify-between gap-6 border-t border-gray-100 pt-3 text-sm">
              {detalle.estado === 'TIMBRADA' ? (
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => descargarXml(detalle)}>Descargar XML</Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={generandoPdfId === detalle.id}
                    onClick={() => descargarPdf(detalle)}
                  >
                    {generandoPdfId === detalle.id ? 'Generando…' : 'Descargar PDF'}
                  </Button>
                </div>
              ) : <span />}
              <div className="flex gap-6">
                <span>Subtotal: <strong>{formatoMoneda(detalle.subtotal)}</strong></span>
                <span>Impuestos: <strong>{formatoMoneda(detalle.totalImpuestosTrasladados)}</strong></span>
                <span>Total: <strong>{formatoMoneda(detalle.total)}</strong></span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal abierto={cancelandoId !== null} onCerrar={() => setCancelandoId(null)} titulo="Cancelar factura">
        <form onSubmit={confirmarCancelar} className="space-y-4">
          <Select
            id="motivoCancelacion"
            label="Motivo de cancelación (SAT)"
            value={motivoCancelacion}
            onChange={(e) => setMotivoCancelacion(e.target.value)}
            required
          >
            {MOTIVOS_CANCELACION.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
          {motivoCancelacion === '01' && (
            <input
              type="text"
              placeholder="ID de la factura que sustituye a esta"
              value={facturaSustitutaId}
              onChange={(e) => setFacturaSustitutaId(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          )}
          {errorCancelar && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{errorCancelar}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCancelandoId(null)}>Volver</Button>
            <Button type="submit" variant="danger">Cancelar factura</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default FacturasPage;
