import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, FileDown, Mail } from 'lucide-react';
import {
  listarCompras, obtenerCompra, cancelarCompra, enviarCompraPorCorreo,
} from '../api/compras.api';
import { useAuth } from '../../../shared/context/AuthContext';
import Card from '../../../shared/ui/Card';
import Badge from '../../../shared/ui/Badge';
import EnviarCorreoModal from '../../../shared/ui/EnviarCorreoModal';
import Paginacion from '../../../shared/ui/Paginacion';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { formatoMoneda } from '../../../shared/format';

const ESTADO_TONO = { CONFIRMADA: 'success', CANCELADA: 'gray' };

const COLUMNAS = [
  { label: 'Folio', clave: 'folio', ordenable: true },
  { label: 'Proveedor', clave: 'proveedor', ordenable: true },
  { label: 'Sucursal', clave: null },
  { label: 'Total', clave: 'total', ordenable: true },
  { label: 'Estado', clave: 'estado', ordenable: true },
  { label: '', clave: null },
];

function ComprasHistorialPage() {
  const location = useLocation();
  const { empresa } = useAuth();
  const [compras, setCompras] = useState([]);
  const [error, setError] = useState('');
  // Prefil con el término del buscador global de la barra superior (TopBar.jsx), si se llegó
  // acá desde un resultado de esa categoría — mismo patrón que VentasHistorialPage/
  // CotizacionesHistorialPage.
  const [busqueda, setBusqueda] = useState(() => location.state?.buscar || '');
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [orden, setOrden] = useState({ ordenarPor: 'creadoEn', orden: 'desc' });

  const [envioCompraId, setEnvioCompraId] = useState(null);
  const [envioCompra, setEnvioCompra] = useState(null);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [errorEnvioCorreo, setErrorEnvioCorreo] = useState('');
  const [exitoEnvioCorreo, setExitoEnvioCorreo] = useState('');

  function cargarCompras(pagina = 1) {
    listarCompras({
      buscar: busqueda || undefined,
      pagina,
      porPagina: 20,
      ordenarPor: orden.ordenarPor,
      orden: orden.orden,
    })
      .then((r) => {
        setCompras(r.datos);
        setPaginacion({ pagina: r.pagina, totalPaginas: r.totalPaginas, total: r.total });
      })
      .catch(() => {});
  }

  function handleOrdenar(clave) {
    setOrden((o) => (o.ordenarPor === clave
      ? { ordenarPor: clave, orden: o.orden === 'asc' ? 'desc' : 'asc' }
      : { ordenarPor: clave, orden: 'asc' }));
  }

  useEffect(() => {
    cargarCompras(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, orden]);

  // jsPDF (+ sus dependencias, ~250kB gzip) solo se descarga cuando alguien realmente pide un
  // PDF, vía import() dinámico, mismo criterio que CotizacionesHistorialPage#descargarPdf.
  async function descargarPdf(compraId) {
    setError('');
    try {
      const [detalle, { generarPdfCompra }] = await Promise.all([
        obtenerCompra(compraId),
        import('../pdf/compraPdf'),
      ]);
      generarPdfCompra(detalle, empresa);
    } catch (err) {
      setError('No se pudo generar el PDF de la compra.');
    }
  }

  async function abrirEnvioCorreo(compraId) {
    setError('');
    setErrorEnvioCorreo('');
    setExitoEnvioCorreo('');
    try {
      const detalle = await obtenerCompra(compraId);
      setEnvioCompra(detalle);
      setEnvioCompraId(compraId);
    } catch (err) {
      setError('No se pudo cargar la compra para enviarla.');
    }
  }

  function cerrarEnvioCorreo() {
    setEnvioCompraId(null);
    setEnvioCompra(null);
  }

  async function enviarCorreoCompra(destinatario, asunto, mensaje) {
    setEnviandoCorreo(true);
    setErrorEnvioCorreo('');
    try {
      const { generarBase64Compra } = await import('../pdf/compraPdf');
      const { base64, nombreArchivo } = generarBase64Compra(envioCompra, empresa);
      await enviarCompraPorCorreo(envioCompraId, {
        destinatario, asunto, mensaje, adjuntoBase64: base64, nombreArchivo,
      });
      setExitoEnvioCorreo(`Compra enviada a ${destinatario}.`);
      cerrarEnvioCorreo();
    } catch (err) {
      setErrorEnvioCorreo(err.response?.data?.error || 'No se pudo enviar el correo.');
    } finally {
      setEnviandoCorreo(false);
    }
  }

  async function handleCancelar(compraId) {
    setError('');
    try {
      await cancelarCompra(compraId);
      cargarCompras(paginacion.pagina);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cancelar la compra.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras recientes</h1>
          <p className="text-sm text-gray-500">Historial de compras, PDF, envío por correo y cancelación.</p>
        </div>
        <Link
          to="/compras"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Volver a compras
        </Link>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
      {exitoEnvioCorreo && <p className="rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">{exitoEnvioCorreo}</p>}

      <Card>
        <div className="relative max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por folio o proveedor..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
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
              onCambiar={cargarCompras}
            />
          )}
        >
          {compras.length === 0 && <TablaVacia colSpan={6} />}
          {compras.map((c) => (
            <Fila key={c.id}>
              <Celda className="font-medium text-gray-800">{c.folio}</Celda>
              <Celda>{c.proveedor?.nombre}</Celda>
              <Celda>{c.sucursal?.nombre}</Celda>
              <Celda>{formatoMoneda(c.total)}</Celda>
              <Celda><Badge tono={ESTADO_TONO[c.estado] || 'gray'}>{c.estado}</Badge></Celda>
              <Celda className="text-right">
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => descargarPdf(c.id)}
                    className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 hover:underline"
                    title="Descargar PDF"
                  >
                    <FileDown size={14} /> PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirEnvioCorreo(c.id)}
                    className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 hover:underline"
                    title="Enviar por correo"
                  >
                    <Mail size={14} /> Enviar
                  </button>
                  {c.estado === 'CONFIRMADA' && (
                    <button type="button" onClick={() => handleCancelar(c.id)} className="text-sm text-danger-600 hover:underline">
                      Cancelar
                    </button>
                  )}
                </div>
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <EnviarCorreoModal
        abierto={envioCompraId !== null}
        onCerrar={cerrarEnvioCorreo}
        titulo="Enviar compra por correo"
        destinatarioSugerido={envioCompra?.proveedor?.correo || ''}
        asuntoSugerido={envioCompra ? `Compra ${envioCompra.folio}` : ''}
        enviando={enviandoCorreo}
        error={errorEnvioCorreo}
        onEnviar={enviarCorreoCompra}
      />
    </div>
  );
}

export default ComprasHistorialPage;
