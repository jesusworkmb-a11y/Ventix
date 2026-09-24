import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard, CheckCircle2, XCircle, Clock } from 'lucide-react';
import {
  obtenerSuscripcion, iniciarPagoSuscripcion, obtenerPagoSuscripcion,
} from '../api/core.api';
import { useAuth } from '../../../shared/context/AuthContext';
import { formatoMoneda, formatoFecha } from '../../../shared/format';
import { diasParaVencerVigencia, vigenciaVencida } from '../../../shared/vigencia';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Badge from '../../../shared/ui/Badge';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';

// Mismo criterio que backend/src/shared/formatearFecha.js: la vigencia se lee en UTC (la que fija
// el superadmin llega como medianoche UTC; en hora local de México se mostraría un día antes).
const formatoVigencia = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'UTC' });

// Reintentos al volver de Mercado Pago: el pago puede tardar unos segundos en quedar aprobado.
const INTENTOS_CONCILIACION = 8;
const ESPERA_CONCILIACION_MS = 3000;

const ESTADO_PAGO = {
  APROBADO: { tono: 'success', texto: 'Aprobado' },
  RECHAZADO: { tono: 'danger', texto: 'Rechazado' },
  PENDIENTE: { tono: 'warning', texto: 'En proceso' },
};

function EstadoVigencia({ vigenciaHasta }) {
  if (!vigenciaHasta) return <Badge tono="gray">Sin vencimiento</Badge>;
  if (vigenciaVencida(vigenciaHasta)) return <Badge tono="danger">Vencida</Badge>;
  const dias = diasParaVencerVigencia(vigenciaHasta);
  if (dias <= 5) return <Badge tono="warning">Vence en {dias} día{dias === 1 ? '' : 's'}</Badge>;
  return <Badge tono="success">Vigente</Badge>;
}

function ResultadoPago({ resultado, vigenciaHasta, onIrAlSistema }) {
  if (resultado.estado === 'verificando') {
    return (
      <Card>
        <p className="flex items-center gap-2 text-sm text-gray-600">
          <Clock size={18} className="animate-pulse text-primary-600" /> Confirmando tu pago con Mercado Pago...
        </p>
      </Card>
    );
  }
  if (resultado.estado === 'APROBADO') {
    return (
      <Card className="border-success-200 bg-success-50">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-success-600" />
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-success-800">¡Pago recibido, gracias!</p>
              {vigenciaHasta && (
                <p className="text-sm text-success-700">
                  Tu suscripción ahora vence el {formatoVigencia.format(new Date(vigenciaHasta))}.
                </p>
              )}
            </div>
            <Button type="button" size="sm" onClick={onIrAlSistema}>Ir al sistema</Button>
          </div>
        </div>
      </Card>
    );
  }
  if (resultado.estado === 'RECHAZADO') {
    return (
      <Card className="border-danger-200 bg-danger-50">
        <p className="flex items-start gap-2 text-sm text-danger-700">
          <XCircle size={18} className="mt-0.5 shrink-0" />
          Mercado Pago no aprobó el pago. No se hizo ningún cargo; puedes intentarlo de nuevo con otro
          medio de pago.
        </p>
      </Card>
    );
  }
  return (
    <Card className="border-warning-200 bg-warning-50">
      <p className="flex items-start gap-2 text-sm text-warning-800">
        <Clock size={18} className="mt-0.5 shrink-0" />
        Tu pago está en proceso (por ejemplo, un pago en efectivo que todavía no se acredita). En
        cuanto Mercado Pago lo confirme, tu suscripción se renueva sola; no hace falta que vuelvas a
        pagar.
      </p>
    </Card>
  );
}

function SuscripcionPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { permisos, empresa, refrescar } = useAuth();
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');
  const [pagando, setPagando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const conciliando = useRef(false);

  const puedePagar = permisos?.includes('administracion.empresa.editar');

  function cargar() {
    return obtenerSuscripcion()
      .then(setResumen)
      .catch((err) => setError(err.response?.data?.error || 'No se pudo cargar tu suscripción.'));
  }

  useEffect(() => {
    if (puedePagar) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedePagar]);

  // Regreso desde Mercado Pago: ?pago=<id nuestro>&payment_id=<id de MP>&status=... Se concilia
  // contra el backend (que a su vez consulta a MP) — el `status` de la URL no se usa para nada,
  // cualquiera puede escribirlo a mano.
  useEffect(() => {
    const pagoId = searchParams.get('pago');
    if (!pagoId || !puedePagar || conciliando.current) return;
    conciliando.current = true;
    const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id');
    setResultado({ estado: 'verificando' });

    (async () => {
      let pago = null;
      for (let i = 0; i < INTENTOS_CONCILIACION; i += 1) {
        try {
          pago = await obtenerPagoSuscripcion(pagoId, paymentId);
          if (pago.estado !== 'PENDIENTE') break;
        } catch {
          // reintenta; si todos fallan queda como "en proceso" y el webhook lo resolverá
        }
        await new Promise((r) => setTimeout(r, ESPERA_CONCILIACION_MS));
      }
      setResultado({ estado: pago?.estado || 'PENDIENTE' });
      if (pago?.estado === 'APROBADO') await refrescar().catch(() => {});
      await cargar();
      setSearchParams({}, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedePagar]);

  async function pagar() {
    setError('');
    setPagando(true);
    try {
      const { initPoint } = await iniciarPagoSuscripcion();
      window.location.href = initPoint;
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo iniciar el pago.');
      setPagando(false);
    }
  }

  // Tras el login los permisos llegan un instante después (setSesion adelanta todo menos
  // permisos, que vienen de /me) — ningún rol real tiene cero permisos, así que vacío = cargando.
  if (!permisos?.length) {
    return <p className="text-sm text-gray-500">Cargando...</p>;
  }

  if (!puedePagar) {
    return (
      <Card>
        <h1 className="text-lg font-semibold text-gray-900">Suscripción</h1>
        <p className="mt-2 text-sm text-gray-600">
          {vigenciaVencida(empresa?.vigenciaHasta)
            ? 'La suscripción de tu empresa venció. '
            : ''}
          Solo el administrador de tu empresa puede consultar y renovar la suscripción.
        </p>
      </Card>
    );
  }

  const vigenciaHasta = resumen?.vigenciaHasta ?? empresa?.vigenciaHasta;
  const vencida = vigenciaVencida(vigenciaHasta);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Suscripción</h1>
        <p className="text-sm text-gray-500">Plan mensual de BOX POS, sin permanencia mínima.</p>
      </div>

      {resultado && (
        <ResultadoPago
          resultado={resultado}
          vigenciaHasta={vigenciaHasta}
          onIrAlSistema={() => navigate('/dashboard')}
        />
      )}

      {vencida && !resultado && (
        <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
          Tu suscripción venció. Renuévala para volver a usar BOX POS; tus datos siguen guardados.
        </p>
      )}

      {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-gray-500">Plan {resumen?.plan || 'Estándar'}</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatoMoneda(resumen?.precioMensual ?? 499)}
              <span className="text-sm font-normal text-gray-500"> MXN / mes</span>
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-gray-600">
              <EstadoVigencia vigenciaHasta={vigenciaHasta} />
              {vigenciaHasta && (
                <span>
                  {vencida ? 'Venció el' : 'Vence el'} {formatoVigencia.format(new Date(vigenciaHasta))}
                </span>
              )}
            </div>
          </div>

          {vigenciaHasta && (
            <div className="w-full space-y-2 sm:w-auto">
              <Button
                type="button"
                onClick={pagar}
                disabled={pagando || !resumen?.pagosEnLinea || resultado?.estado === 'verificando'}
                className="w-full sm:w-auto"
              >
                <CreditCard size={16} />
                {pagando ? 'Abriendo Mercado Pago...' : 'Pagar 1 mes con Mercado Pago'}
              </Button>
              {resumen && !resumen.pagosEnLinea && (
                <p className="text-xs text-gray-500">Los pagos en línea todavía no están disponibles.</p>
              )}
            </div>
          )}
        </div>
        <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
          {vigenciaHasta
            ? 'Si pagas antes de que venza, el mes se suma a los días que te quedan. Aceptamos tarjeta, '
              + 'saldo de Mercado Pago y efectivo en tiendas (el pago en efectivo tarda en acreditarse).'
            : 'Tu empresa no tiene fecha de vencimiento, no necesitas pagar.'}
        </p>
      </Card>

      <div className="space-y-2">
        <h2 className="text-base font-semibold text-gray-900">Pagos</h2>
        <Table columnas={['Fecha', 'Monto', 'Estado', 'Vigencia nueva']}>
          {resumen && resumen.pagos.length === 0 && <TablaVacia colSpan={4} mensaje="Todavía no hay pagos." />}
          {resumen?.pagos.map((p) => (
            <Fila key={p.id}>
              <Celda>{formatoFecha(p.aplicadoEn || p.creadoEn)}</Celda>
              <Celda>{formatoMoneda(p.monto)}</Celda>
              <Celda><Badge tono={ESTADO_PAGO[p.estado].tono}>{ESTADO_PAGO[p.estado].texto}</Badge></Celda>
              <Celda>{p.vigenciaNueva ? formatoVigencia.format(new Date(p.vigenciaNueva)) : '—'}</Celda>
            </Fila>
          ))}
        </Table>
      </div>
    </div>
  );
}

export default SuscripcionPage;
