import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Trash2, Printer, Mail } from 'lucide-react';
import {
  listarVentas, cancelarVenta, obtenerVenta, enviarTicketPorCorreo,
} from '../api/ventas.api';
import { crearDevolucion } from '../api/devoluciones.api';
import { listarCajas, listarSesiones } from '../../caja/api/caja.api';
import { listarUsuarios } from '../../core/api/core.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';
import Modal from '../../../shared/ui/Modal';
import EnviarCorreoModal from '../../../shared/ui/EnviarCorreoModal';
import Paginacion from '../../../shared/ui/Paginacion';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import TicketVenta from '../components/TicketVenta';
import { formatoMoneda } from '../../../shared/format';
import { useAuth } from '../../../shared/context/AuthContext';

const COLUMNAS = [
  { label: 'Folio', clave: 'folio', ordenable: true },
  { label: 'Cliente', clave: 'cliente', ordenable: true },
  { label: 'Total', clave: 'total', ordenable: true },
  { label: 'Estado', clave: 'estado', ordenable: true },
  { label: '', clave: null },
];

const MOTIVOS_DEVOLUCION = ['Producto defectuoso', 'Error de venta', 'Cliente cambió de opinión', 'Garantía', 'Otro'];

const ESTADO_TONO = { CONFIRMADA: 'success', CANCELADA: 'gray' };

function VentasHistorialPage() {
  const location = useLocation();
  const { empresa } = useAuth();
  const [ventas, setVentas] = useState([]);
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  // Prefil con el término del buscador global de la barra superior (TopBar.jsx), si se
  // llegó acá desde un resultado de esa categoría.
  const [busqueda, setBusqueda] = useState(() => location.state?.buscar || '');
  const [orden, setOrden] = useState({ ordenarPor: 'creadoEn', orden: 'desc' });
  const [usuarios, setUsuarios] = useState([]);
  const [cajas, setCajas] = useState([]);
  const [sesionesAbiertas, setSesionesAbiertas] = useState([]);
  const [error, setError] = useState('');

  const [devolviendoId, setDevolviendoId] = useState(null);
  const [ventaDevolucion, setVentaDevolucion] = useState(null);
  const [devArticuloId, setDevArticuloId] = useState('');
  const [devCantidad, setDevCantidad] = useState('1');
  const [devVuelveAStock, setDevVuelveAStock] = useState(true);
  const [devCarrito, setDevCarrito] = useState([]);
  const [devMotivo, setDevMotivo] = useState(MOTIVOS_DEVOLUCION[0]);
  const [devAutorizadoPorId, setDevAutorizadoPorId] = useState('');
  const [devError, setDevError] = useState('');

  const [ticketVenta, setTicketVenta] = useState(null);
  const [ticketAbierto, setTicketAbierto] = useState(false);
  const [envioTicketAbierto, setEnvioTicketAbierto] = useState(false);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [errorEnvioCorreo, setErrorEnvioCorreo] = useState('');
  const [exitoEnvioCorreo, setExitoEnvioCorreo] = useState('');

  function cargarVentas(pagina = 1) {
    listarVentas({
      buscar: busqueda || undefined,
      pagina,
      porPagina: 20,
      ordenarPor: orden.ordenarPor,
      orden: orden.orden,
    })
      .then((r) => {
        setVentas(r.datos);
        setPaginacion({ pagina: r.pagina, totalPaginas: r.totalPaginas, total: r.total });
      })
      .catch(() => {});
  }

  useEffect(() => {
    listarUsuarios().then(setUsuarios).catch(() => {});
    listarCajas().then(setCajas).catch(() => {});
    listarSesiones({ abierta: 'true' }).then(setSesionesAbiertas).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarVentas(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, orden]);

  function handleOrdenar(clave) {
    setOrden((o) => (o.ordenarPor === clave
      ? { ordenarPor: clave, orden: o.orden === 'asc' ? 'desc' : 'asc' }
      : { ordenarPor: clave, orden: 'asc' }));
  }

  // Una devolución con reembolso necesita una sesión de caja abierta de la MISMA sucursal
  // que la venta original (así lo exige registrarMovimientoCaja en el backend) — se resuelve
  // sola en vez de pedirle al usuario que elija la caja correcta a mano.
  function sesionParaSucursal(sucursalId) {
    const cajaIds = cajas.filter((c) => c.sucursalId === sucursalId).map((c) => c.id);
    return sesionesAbiertas.find((s) => cajaIds.includes(s.cajaId)) || null;
  }

  async function imprimirTicket(ventaId) {
    setError('');
    setTicketVenta(null);
    setTicketAbierto(true);
    try {
      const detalle = await obtenerVenta(ventaId);
      setTicketVenta(detalle);
    } catch (err) {
      setError('No se pudo cargar el ticket de la venta.');
      setTicketAbierto(false);
    }
  }

  async function enviarCorreoTicket(destinatario, asunto, mensaje) {
    setEnviandoCorreo(true);
    setErrorEnvioCorreo('');
    try {
      const { generarBase64Ticket } = await import('../pdf/ticketPdf');
      const { base64, nombreArchivo } = generarBase64Ticket(ticketVenta, empresa, null);
      await enviarTicketPorCorreo(ticketVenta.id, {
        destinatario, asunto, mensaje, adjuntoBase64: base64, nombreArchivo,
      });
      setExitoEnvioCorreo(`Ticket enviado a ${destinatario}.`);
      setEnvioTicketAbierto(false);
    } catch (err) {
      setErrorEnvioCorreo(err.response?.data?.error || 'No se pudo enviar el correo.');
    } finally {
      setEnviandoCorreo(false);
    }
  }

  async function abrirEnvioTicket(ventaId) {
    setError('');
    setErrorEnvioCorreo('');
    setExitoEnvioCorreo('');
    setTicketVenta(null);
    try {
      const detalle = await obtenerVenta(ventaId);
      setTicketVenta(detalle);
      setEnvioTicketAbierto(true);
    } catch (err) {
      setError('No se pudo cargar el ticket de la venta.');
    }
  }

  async function handleCancelar(ventaId) {
    setError('');
    try {
      await cancelarVenta(ventaId);
      cargarVentas(paginacion.pagina);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cancelar la venta.');
    }
  }

  async function abrirDevolucion(venta) {
    setDevError('');
    setDevCarrito([]);
    setDevMotivo(MOTIVOS_DEVOLUCION[0]);
    setDevAutorizadoPorId('');
    setDevolviendoId(venta.id);
    try {
      const detalle = await obtenerVenta(venta.id);
      setVentaDevolucion(detalle);
    } catch (err) {
      setDevError('No se pudo cargar el detalle de la venta.');
    }
  }

  function cerrarDevolucion() {
    setDevolviendoId(null);
    setVentaDevolucion(null);
    setDevCarrito([]);
  }

  function agregarLineaDevolucion(e) {
    e.preventDefault();
    const linea = ventaDevolucion?.detalles.find((d) => d.articuloId === devArticuloId);
    if (!linea) return;
    const yaEnCarrito = devCarrito
      .filter((l) => l.articuloId === devArticuloId)
      .reduce((acc, l) => acc + l.cantidad, 0);
    const disponible = Number(linea.cantidad) - Number(linea.cantidadDevuelta) - yaEnCarrito;
    const cant = Number(devCantidad);
    if (cant <= 0 || cant > disponible) {
      setDevError(`Cantidad inválida (disponible para devolver: ${disponible}).`);
      return;
    }
    setDevError('');
    setDevCarrito((c) => [
      ...c,
      {
        articuloId: devArticuloId,
        nombre: linea.articulo?.nombre || devArticuloId,
        cantidad: cant,
        precio: Number(linea.precio),
        impuestoTasa: Number(linea.impuestoTasa),
        vuelveAStock: devVuelveAStock,
      },
    ]);
    setDevArticuloId('');
    setDevCantidad('1');
  }

  function quitarLineaDevolucion(index) {
    setDevCarrito((c) => c.filter((_, i) => i !== index));
  }

  const devReembolso = Math.round(
    devCarrito.reduce((acc, l) => acc + l.cantidad * l.precio * (1 + l.impuestoTasa), 0) * 100,
  ) / 100;

  async function confirmarDevolucion(e) {
    e.preventDefault();
    setDevError('');
    if (devCarrito.length === 0) {
      setDevError('Agrega al menos un artículo a devolver.');
      return;
    }
    if (!devAutorizadoPorId) {
      setDevError('Selecciona quién autoriza la devolución.');
      return;
    }
    const sesion = sesionParaSucursal(ventaDevolucion.sucursalId);
    if (devReembolso > 0 && !sesion) {
      setDevError('Esta devolución implica un reembolso; abre una sesión de caja para la sucursal de esta venta primero.');
      return;
    }
    try {
      await crearDevolucion({
        ventaId: ventaDevolucion.id,
        motivo: devMotivo,
        autorizadoPorId: devAutorizadoPorId,
        sesionCajaId: devReembolso > 0 ? sesion.id : undefined,
        detalles: devCarrito.map((l) => ({
          articuloId: l.articuloId,
          cantidad: l.cantidad,
          vuelveAStock: l.vuelveAStock,
        })),
      });
      cerrarDevolucion();
      cargarVentas(paginacion.pagina);
    } catch (err) {
      setDevError(err.response?.data?.error || 'No se pudo procesar la devolución.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas recientes</h1>
          <p className="text-sm text-gray-500">Historial de ventas, cancelaciones y devoluciones.</p>
        </div>
        <Link
          to="/ventas"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Volver a Ventas
        </Link>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
      {exitoEnvioCorreo && <p className="rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">{exitoEnvioCorreo}</p>}

      <Card>
        <div className="relative max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por folio o cliente..."
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
              onCambiar={cargarVentas}
            />
          )}
        >
          {ventas.length === 0 && <TablaVacia colSpan={5} />}
          {ventas.map((v) => (
            <Fila key={v.id}>
              <Celda className="font-medium text-gray-800">{v.folio}</Celda>
              <Celda>{v.cliente?.nombre}</Celda>
              <Celda>{formatoMoneda(v.total)}</Celda>
              <Celda><Badge tono={ESTADO_TONO[v.estado] || 'gray'}>{v.estado}</Badge></Celda>
              <Celda className="text-right">
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => imprimirTicket(v.id)}
                    className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 hover:underline"
                    title="Imprimir ticket"
                  >
                    <Printer size={14} /> Imprimir
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirEnvioTicket(v.id)}
                    className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 hover:underline"
                    title="Enviar por correo"
                  >
                    <Mail size={14} /> Enviar
                  </button>
                  {v.estado === 'CONFIRMADA' && (
                    <>
                      <button type="button" onClick={() => handleCancelar(v.id)} className="text-sm text-danger-600 hover:underline">
                        Cancelar
                      </button>
                      <button type="button" onClick={() => abrirDevolucion(v)} className="text-sm text-primary-600 hover:underline">
                        Devolver
                      </button>
                    </>
                  )}
                </div>
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>

      <Modal abierto={devolviendoId !== null} onCerrar={cerrarDevolucion} titulo="Registrar devolución" ancho="max-w-2xl">
        {devError && <p className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{devError}</p>}
        {!ventaDevolucion && <p className="text-sm text-gray-500">Cargando detalle de la venta…</p>}
        {ventaDevolucion && (
          <>
            <form onSubmit={agregarLineaDevolucion} className="flex flex-wrap items-end gap-3">
              <Select
                id="devArticulo"
                label="Artículo vendido"
                value={devArticuloId}
                onChange={(e) => setDevArticuloId(e.target.value)}
                required
                className="min-w-[220px]"
              >
                <option value="">Selecciona un artículo...</option>
                {ventaDevolucion.detalles.map((d) => (
                  <option key={d.articuloId} value={d.articuloId}>
                    {d.articulo?.nombre || d.articuloId} (disponible: {Number(d.cantidad) - Number(d.cantidadDevuelta)})
                  </option>
                ))}
              </Select>
              <Input
                id="devCantidad"
                label="Cantidad"
                type="number"
                step="0.01"
                min="0.01"
                value={devCantidad}
                onChange={(e) => setDevCantidad(e.target.value)}
                className="w-28"
                required
              />
              <label className="flex items-center gap-2 pb-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={devVuelveAStock}
                  onChange={(e) => setDevVuelveAStock(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Vuelve a stock
              </label>
              <Button type="submit" variant="secondary">Agregar</Button>
            </form>

            {devCarrito.length > 0 && (
              <div className="mt-4">
                <Table columnas={['Artículo', 'Cantidad', 'Vuelve a stock', '']}>
                  {devCarrito.map((l, i) => (
                    <Fila key={i}>
                      <Celda>{l.nombre}</Celda>
                      <Celda>{l.cantidad}</Celda>
                      <Celda>{l.vuelveAStock ? 'Sí' : 'No'}</Celda>
                      <Celda className="text-right">
                        <button type="button" onClick={() => quitarLineaDevolucion(i)} className="text-gray-400 hover:text-danger-600">
                          <Trash2 size={16} />
                        </button>
                      </Celda>
                    </Fila>
                  ))}
                </Table>
              </div>
            )}

            <form onSubmit={confirmarDevolucion} className="mt-4 flex flex-wrap items-end gap-3">
              <Select
                id="devMotivo"
                label="Motivo"
                value={devMotivo}
                onChange={(e) => setDevMotivo(e.target.value)}
              >
                {MOTIVOS_DEVOLUCION.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
              <Select
                id="devAutorizadoPor"
                label="Autoriza"
                value={devAutorizadoPorId}
                onChange={(e) => setDevAutorizadoPorId(e.target.value)}
                required
              >
                <option value="">Selecciona quién autoriza...</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </Select>
              <span className="pb-2 text-sm font-medium text-gray-700">Reembolso: {formatoMoneda(devReembolso)}</span>
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="secondary" onClick={cerrarDevolucion}>Cancelar</Button>
                <Button type="submit">Confirmar devolución</Button>
              </div>
            </form>
          </>
        )}
      </Modal>

      <Modal abierto={ticketAbierto} onCerrar={() => setTicketAbierto(false)} titulo="Ticket de venta" ancho="max-w-sm">
        {!ticketVenta && <p className="text-sm text-gray-500">Cargando ticket…</p>}
        <TicketVenta venta={ticketVenta} />
        {ticketVenta && (
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setTicketAbierto(false)}>Cerrar</Button>
            <Button type="button" onClick={() => window.print()}>
              <Printer size={16} /> Imprimir
            </Button>
          </div>
        )}
      </Modal>

      <EnviarCorreoModal
        abierto={envioTicketAbierto}
        onCerrar={() => setEnvioTicketAbierto(false)}
        titulo="Enviar ticket por correo"
        destinatarioSugerido={ticketVenta?.cliente?.correo || ''}
        asuntoSugerido={ticketVenta ? `Ticket de venta ${ticketVenta.folio}` : ''}
        enviando={enviandoCorreo}
        error={errorEnvioCorreo}
        onEnviar={enviarCorreoTicket}
      />
    </div>
  );
}

export default VentasHistorialPage;
