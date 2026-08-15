import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileDown, Search, Mail } from 'lucide-react';
import {
  listarCotizaciones, obtenerCotizacion, convertirCotizacion, enviarCotizacionPorCorreo,
} from '../api/cotizaciones.api';
import { listarCajas, listarSesiones } from '../../caja/api/caja.api';
import { listarArticulos } from '../../catalogo/api/catalogo.api';
import { listarUsuarios } from '../../core/api/core.api';
import { useAuth } from '../../../shared/context/AuthContext';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';
import Modal from '../../../shared/ui/Modal';
import EnviarCorreoModal from '../../../shared/ui/EnviarCorreoModal';
import Paginacion from '../../../shared/ui/Paginacion';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { formatoMoneda } from '../../../shared/format';

const COLUMNAS_COTIZACIONES = [
  { label: 'Folio', clave: 'folio', ordenable: true },
  { label: 'Total', clave: 'total', ordenable: true },
  { label: 'Vigencia', clave: null },
  { label: 'Estado', clave: null },
  { label: '', clave: null },
];

// Mismo criterio de "fecha de calendario pura" que CotizacionesPage — comparar/formatear por
// substring en vez de con un Date completo evita el corrimiento por zona horaria del navegador.
function formatoFechaCorta(fechaIso) {
  if (!fechaIso) return '';
  const [anio, mes, dia] = fechaIso.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

function estaVencida(fechaIso) {
  if (!fechaIso) return false;
  const hoy = new Date();
  const hoyUtc = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const [anio, mes, dia] = fechaIso.slice(0, 10).split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia) < hoyUtc;
}

function CotizacionesHistorialPage() {
  const location = useLocation();
  const { empresa } = useAuth();
  const [articulos, setArticulos] = useState([]);
  const [error, setError] = useState('');
  const [cotizaciones, setCotizaciones] = useState([]);
  // Prefil con el término del buscador global de la barra superior (TopBar.jsx), si se
  // llegó acá desde un resultado de esa categoría — mismo patrón que VentasHistorialPage.
  const [busqueda, setBusqueda] = useState(() => location.state?.buscar || '');
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [orden, setOrden] = useState({ ordenarPor: 'creadoEn', orden: 'desc' });

  const [cajas, setCajas] = useState([]);
  const [cajaId, setCajaId] = useState('');
  const [sesion, setSesion] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [convirtiendoId, setConvirtiendoId] = useState(null);
  const [convTotal, setConvTotal] = useState(null);
  const [convMetodoPago, setConvMetodoPago] = useState('EFECTIVO');
  const [convRequiereAutorizacion, setConvRequiereAutorizacion] = useState(false);
  const [convAutorizadoPorId, setConvAutorizadoPorId] = useState('');
  const [convError, setConvError] = useState('');

  const [envioCotizacionId, setEnvioCotizacionId] = useState(null);
  const [envioCotizacion, setEnvioCotizacion] = useState(null);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [errorEnvioCorreo, setErrorEnvioCorreo] = useState('');
  const [exitoEnvioCorreo, setExitoEnvioCorreo] = useState('');

  useEffect(() => {
    listarArticulos().then(setArticulos).catch(() => {});
    listarCajas()
      .then((data) => {
        setCajas(data);
        if (data.length) setCajaId((actual) => actual || data[0].id);
      })
      .catch(() => {});
    listarUsuarios().then(setUsuarios).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cajaId) verificarSesion(cajaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cajaId]);

  function cargarCotizaciones(pagina = 1) {
    listarCotizaciones({
      buscar: busqueda || undefined,
      pagina,
      porPagina: 20,
      ordenarPor: orden.ordenarPor,
      orden: orden.orden,
    })
      .then((r) => {
        setCotizaciones(r.datos);
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
    cargarCotizaciones(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, orden]);

  // jsPDF (+ sus dependencias, ~250kB gzip) solo se descarga cuando alguien realmente pide un
  // PDF, vía import() dinámico, para no engordar el bundle inicial de toda la app por una
  // función que se usa solo en esta pantalla.
  async function descargarPdf(cotizacionId) {
    setError('');
    try {
      const [detalle, { generarPdfCotizacion }] = await Promise.all([
        obtenerCotizacion(cotizacionId),
        import('../pdf/cotizacionPdf'),
      ]);
      generarPdfCotizacion(detalle, empresa);
    } catch (err) {
      setError('No se pudo generar el PDF de la cotización.');
    }
  }

  // Reusa el detalle completo de la cotización (mismo obtenerCotizacion que descargarPdf) tanto
  // para prellenar el destinatario sugerido (cliente.correo, puede venir vacío) como para armar
  // el PDF recién al confirmar el envío.
  async function abrirEnvioCorreo(cotizacionId) {
    setError('');
    setErrorEnvioCorreo('');
    setExitoEnvioCorreo('');
    try {
      const detalle = await obtenerCotizacion(cotizacionId);
      setEnvioCotizacion(detalle);
      setEnvioCotizacionId(cotizacionId);
    } catch (err) {
      setError('No se pudo cargar la cotización para enviarla.');
    }
  }

  function cerrarEnvioCorreo() {
    setEnvioCotizacionId(null);
    setEnvioCotizacion(null);
  }

  async function enviarCorreoCotizacion(destinatario, asunto, mensaje) {
    setEnviandoCorreo(true);
    setErrorEnvioCorreo('');
    try {
      const { generarBase64Cotizacion } = await import('../pdf/cotizacionPdf');
      const { base64, nombreArchivo } = generarBase64Cotizacion(envioCotizacion, empresa);
      await enviarCotizacionPorCorreo(envioCotizacionId, {
        destinatario, asunto, mensaje, adjuntoBase64: base64, nombreArchivo,
      });
      setExitoEnvioCorreo(`Cotización enviada a ${destinatario}.`);
      cerrarEnvioCorreo();
    } catch (err) {
      setErrorEnvioCorreo(err.response?.data?.error || 'No se pudo enviar el correo.');
    } finally {
      setEnviandoCorreo(false);
    }
  }

  async function verificarSesion(id) {
    try {
      const abiertas = await listarSesiones({ cajaId: id, abierta: 'true' });
      setSesion(abiertas[0] || null);
    } catch (err) {
      setSesion(null);
    }
  }

  // Cotizacion.total ya incluye impuesto (congelado a la tasa vigente cuando se creó la
  // cotización — ver cotizaciones.service.js#crear), pero al convertir se cobra dinero real, así
  // que acá se recalcula con la tasa VIGENTE en este momento (igual que ventasService.crear) en
  // vez de reusar ese total ya guardado — si la tasa de algún artículo cambió desde que se
  // cotizó, lo correcto es cobrar la vigente, no la congelada. En el caso normal (tasa sin
  // cambios) el resultado coincide exactamente con Cotizacion.total. También hay que restar el
  // descuento manual de cada línea antes de aplicar la tasa.
  async function abrirConversion(cotizacionId) {
    setConvError('');
    setConvTotal(null);
    setConvAutorizadoPorId('');
    setConvirtiendoId(cotizacionId);
    try {
      const detalle = await obtenerCotizacion(cotizacionId);
      const totalConImpuesto = detalle.detalles.reduce((acc, d) => {
        const articulo = articulos.find((a) => a.id === d.articuloId);
        const tasa = articulo?.impuesto ? Number(articulo.impuesto.tasa) : 0;
        const neto = Number(d.cantidad) * Number(d.precio) - Number(d.descuentoMonto || 0);
        return acc + neto * (1 + tasa);
      }, 0);
      setConvTotal(Math.round(totalConImpuesto * 100) / 100);
      // Cualquier descuento en una cotización es manual (sin catálogo), y un descuento manual
      // siempre exige autorización de Supervisor al convertir (ver resolverDescuentoLinea).
      setConvRequiereAutorizacion(detalle.detalles.some((d) => Number(d.descuentoMonto) > 0));
    } catch (err) {
      setConvError('No se pudo calcular el total a cobrar.');
    }
  }

  function cerrarConversion() {
    setConvirtiendoId(null);
  }

  async function confirmarConversion(e, cotizacion) {
    e.preventDefault();
    setConvError('');
    if (!sesion) {
      setConvError('No hay una sesión de caja abierta para esta caja.');
      return;
    }
    if (convTotal === null) return;
    if (convRequiereAutorizacion && !convAutorizadoPorId) {
      setConvError('Esta cotización tiene un descuento manual — selecciona quién autoriza.');
      return;
    }
    try {
      await convertirCotizacion(cotizacion.id, {
        sesionCajaId: sesion.id,
        pagos: [{ metodo: convMetodoPago, monto: convTotal }],
        ...(convAutorizadoPorId && { autorizadoPorId: convAutorizadoPorId }),
      });
      setConvirtiendoId(null);
      cargarCotizaciones(paginacion.pagina);
    } catch (err) {
      setConvError(err.response?.data?.error || 'No se pudo convertir la cotización.');
    }
  }

  const cotizacionEnConversion = cotizaciones.find((c) => c.id === convirtiendoId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones recientes</h1>
          <p className="text-sm text-gray-500">Historial de cotizaciones y su conversión a venta.</p>
        </div>
        <Link
          to="/ventas/cotizaciones"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Volver a cotizaciones
        </Link>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
      {exitoEnvioCorreo && <p className="rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">{exitoEnvioCorreo}</p>}

      <Card title="Convertir en venta">
        {cajas.length > 0 && (
          <Select id="cajaCobro" label="Caja para cobrar" value={cajaId} onChange={(e) => setCajaId(e.target.value)}>
            {cajas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Select>
        )}
        {cajaId && !sesion && (
          <p className="mt-3 rounded-lg bg-warning-50 px-4 py-2.5 text-sm text-warning-700">
            Esta caja no tiene una sesión abierta. <Link to="/caja" className="font-medium underline">Abre una en Caja</Link> antes de convertir.
          </p>
        )}
      </Card>

      <Card>
        <div className="relative max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por folio..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </Card>

      <Card>
        <Table
          columnas={COLUMNAS_COTIZACIONES}
          ordenarPor={orden.ordenarPor}
          orden={orden.orden}
          onOrdenar={handleOrdenar}
          pie={(
            <Paginacion
              pagina={paginacion.pagina}
              totalPaginas={paginacion.totalPaginas}
              total={paginacion.total}
              onCambiar={cargarCotizaciones}
            />
          )}
        >
          {cotizaciones.length === 0 && <TablaVacia colSpan={5} />}
          {cotizaciones.map((c) => (
            <Fila key={c.id}>
              <Celda className="font-medium text-gray-800">{c.folio}</Celda>
              <Celda>{formatoMoneda(c.total)}</Celda>
              <Celda>
                {c.vigencia ? (
                  <span className={estaVencida(c.vigencia) && !c.convertidaEnVentaId ? 'text-danger-600' : 'text-gray-500'}>
                    {formatoFechaCorta(c.vigencia)}
                  </span>
                ) : '—'}
              </Celda>
              <Celda>
                <Badge tono={c.convertidaEnVentaId ? 'success' : 'warning'}>
                  {c.convertidaEnVentaId ? 'Convertida' : 'Pendiente'}
                </Badge>
              </Celda>
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
                  {!c.convertidaEnVentaId && (
                    <button type="button" onClick={() => abrirConversion(c.id)} className="text-sm text-primary-600 hover:underline">
                      Convertir en venta
                    </button>
                  )}
                </div>
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <Modal abierto={convirtiendoId !== null} onCerrar={cerrarConversion} titulo="Convertir cotización en venta">
        {convError && <p className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{convError}</p>}
        <form onSubmit={(e) => confirmarConversion(e, cotizacionEnConversion)} className="flex flex-col gap-4">
          <Select
            id="convMetodoPago"
            label="Método de pago"
            value={convMetodoPago}
            onChange={(e) => setConvMetodoPago(e.target.value)}
          >
            <option value="EFECTIVO">Efectivo</option>
            <option value="TARJETA">Tarjeta</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="MIXTO">Mixto</option>
          </Select>
          <p className="text-sm font-medium text-gray-700">
            Total a cobrar: {convTotal === null ? 'calculando…' : formatoMoneda(convTotal)}
          </p>
          {convRequiereAutorizacion && (
            <>
              <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
                Esta cotización incluye un descuento manual — requiere autorización de un
                Supervisor para convertirse en venta.
              </p>
              <Select
                id="convAutorizadoPorId"
                label="Autoriza"
                value={convAutorizadoPorId}
                onChange={(e) => setConvAutorizadoPorId(e.target.value)}
              >
                <option value="">Selecciona quién autoriza</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </Select>
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={cerrarConversion}>Cancelar</Button>
            <Button type="submit" disabled={convTotal === null}>Confirmar conversión</Button>
          </div>
        </form>
      </Modal>

      <EnviarCorreoModal
        abierto={envioCotizacionId !== null}
        onCerrar={cerrarEnvioCorreo}
        titulo="Enviar cotización por correo"
        destinatarioSugerido={envioCotizacion?.cliente?.correo || ''}
        asuntoSugerido={envioCotizacion ? `Cotización ${envioCotizacion.folio}` : ''}
        enviando={enviandoCorreo}
        error={errorEnvioCorreo}
        onEnviar={enviarCorreoCotizacion}
      />
    </div>
  );
}

export default CotizacionesHistorialPage;
