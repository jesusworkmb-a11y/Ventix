import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, FileDown, Mail } from 'lucide-react';
import {
  listarOrdenesCompra, obtenerOrdenCompra, cancelarOrdenCompra, cerrarOrdenCompra, enviarOrdenCompraPorCorreo,
} from '../api/ordenes.api';
import { useAuth } from '../../../shared/context/AuthContext';
import Card from '../../../shared/ui/Card';
import Badge from '../../../shared/ui/Badge';
import EnviarCorreoModal from '../../../shared/ui/EnviarCorreoModal';
import Paginacion from '../../../shared/ui/Paginacion';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';

const ESTADO_TONO = {
  ENVIADA: 'primary', PARCIAL: 'warning', RECIBIDA: 'success', CERRADA: 'gray', CANCELADA: 'danger',
};
const ESTADO_LABEL = {
  ENVIADA: 'Enviada', PARCIAL: 'Parcial', RECIBIDA: 'Recibida', CERRADA: 'Cerrada', CANCELADA: 'Cancelada',
};

const COLUMNAS = [
  { label: 'Folio', clave: 'folio', ordenable: true },
  { label: 'Proveedor', clave: 'proveedor', ordenable: true },
  { label: 'Sucursal', clave: null },
  { label: 'Estado', clave: 'estado', ordenable: true },
  { label: '', clave: null },
];

function OrdenesCompraHistorialPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { empresa } = useAuth();
  const [ordenes, setOrdenes] = useState([]);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState(() => location.state?.buscar || '');
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [orden, setOrden] = useState({ ordenarPor: 'creadoEn', orden: 'desc' });

  const [envioOrdenId, setEnvioOrdenId] = useState(null);
  const [envioOrden, setEnvioOrden] = useState(null);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [errorEnvioCorreo, setErrorEnvioCorreo] = useState('');
  const [exitoEnvioCorreo, setExitoEnvioCorreo] = useState('');

  function cargarOrdenes(pagina = 1) {
    listarOrdenesCompra({
      buscar: busqueda || undefined,
      pagina,
      porPagina: 20,
      ordenarPor: orden.ordenarPor,
      orden: orden.orden,
    })
      .then((r) => {
        setOrdenes(r.datos);
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
    cargarOrdenes(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, orden]);

  async function descargarPdf(ordenCompraId) {
    setError('');
    try {
      const [detalle, { generarPdfOrdenCompra }] = await Promise.all([
        obtenerOrdenCompra(ordenCompraId),
        import('../pdf/ordenCompraPdf'),
      ]);
      generarPdfOrdenCompra(detalle, empresa);
    } catch (err) {
      setError('No se pudo generar el PDF de la orden.');
    }
  }

  async function abrirEnvioCorreo(ordenCompraId) {
    setError('');
    setErrorEnvioCorreo('');
    setExitoEnvioCorreo('');
    try {
      const detalle = await obtenerOrdenCompra(ordenCompraId);
      setEnvioOrden(detalle);
      setEnvioOrdenId(ordenCompraId);
    } catch (err) {
      setError('No se pudo cargar la orden para enviarla.');
    }
  }

  function cerrarEnvioCorreo() {
    setEnvioOrdenId(null);
    setEnvioOrden(null);
  }

  async function enviarCorreoOrden(destinatario, asunto, mensaje) {
    setEnviandoCorreo(true);
    setErrorEnvioCorreo('');
    try {
      const { generarBase64OrdenCompra } = await import('../pdf/ordenCompraPdf');
      const { base64, nombreArchivo } = generarBase64OrdenCompra(envioOrden, empresa);
      await enviarOrdenCompraPorCorreo(envioOrdenId, {
        destinatario, asunto, mensaje, adjuntoBase64: base64, nombreArchivo,
      });
      setExitoEnvioCorreo(`Orden enviada a ${destinatario}.`);
      cerrarEnvioCorreo();
    } catch (err) {
      setErrorEnvioCorreo(err.response?.data?.error || 'No se pudo enviar el correo.');
    } finally {
      setEnviandoCorreo(false);
    }
  }

  async function handleCancelar(ordenCompraId) {
    setError('');
    try {
      await cancelarOrdenCompra(ordenCompraId);
      cargarOrdenes(paginacion.pagina);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cancelar la orden.');
    }
  }

  async function handleCerrar(ordenCompraId) {
    setError('');
    try {
      await cerrarOrdenCompra(ordenCompraId);
      cargarOrdenes(paginacion.pagina);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cerrar la orden.');
    }
  }

  function handleRecibir(ordenCompraId) {
    navigate('/compras', { state: { ordenCompraId } });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Órdenes de compra recientes</h1>
          <p className="text-sm text-gray-500">
            Historial de órdenes, PDF, envío por correo, recepción y cierre.
          </p>
        </div>
        <Link
          to="/compras/ordenes"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Volver a órdenes
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
              onCambiar={cargarOrdenes}
            />
          )}
        >
          {ordenes.length === 0 && <TablaVacia colSpan={5} />}
          {ordenes.map((o) => {
            const puedeRecibir = o.estado === 'ENVIADA' || o.estado === 'PARCIAL';
            return (
              <Fila key={o.id}>
                <Celda className="font-medium text-gray-800">{o.folio}</Celda>
                <Celda>{o.proveedor?.nombre}</Celda>
                <Celda>{o.sucursal?.nombre}</Celda>
                <Celda><Badge tono={ESTADO_TONO[o.estado] || 'gray'}>{ESTADO_LABEL[o.estado] || o.estado}</Badge></Celda>
                <Celda className="text-right">
                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => descargarPdf(o.id)}
                      className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 hover:underline"
                      title="Descargar PDF"
                    >
                      <FileDown size={14} /> PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirEnvioCorreo(o.id)}
                      className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 hover:underline"
                      title="Enviar por correo"
                    >
                      <Mail size={14} /> Enviar
                    </button>
                    {puedeRecibir && (
                      <button type="button" onClick={() => handleRecibir(o.id)} className="text-sm text-primary-600 hover:underline">
                        Recibir
                      </button>
                    )}
                    {puedeRecibir && (
                      <button type="button" onClick={() => handleCerrar(o.id)} className="text-sm text-gray-500 hover:underline">
                        Cerrar
                      </button>
                    )}
                    {o.estado === 'ENVIADA' && (
                      <button type="button" onClick={() => handleCancelar(o.id)} className="text-sm text-danger-600 hover:underline">
                        Cancelar
                      </button>
                    )}
                  </div>
                </Celda>
              </Fila>
            );
          })}
        </Table>
      </Card>

      <EnviarCorreoModal
        abierto={envioOrdenId !== null}
        onCerrar={cerrarEnvioCorreo}
        titulo="Enviar orden de compra por correo"
        destinatarioSugerido={envioOrden?.proveedor?.correo || ''}
        asuntoSugerido={envioOrden ? `Orden de compra ${envioOrden.folio}` : ''}
        enviando={enviandoCorreo}
        error={errorEnvioCorreo}
        onEnviar={enviarCorreoOrden}
      />
    </div>
  );
}

export default OrdenesCompraHistorialPage;
