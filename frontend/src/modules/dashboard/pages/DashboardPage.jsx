import {
  ShoppingCart,
  Wallet,
  Package,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Info,
  CheckCircle2,
  ShoppingBag,
  SlidersHorizontal,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../../shared/context/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import Card from '../../../shared/ui/Card';
import StatCard from '../../../shared/ui/StatCard';
import TrendChart from '../../../shared/ui/TrendChart';
import { formatoMoneda, tiempoRelativo } from '../../../shared/format';

const ICONO_MOVIMIENTO = {
  venta: { icon: ShoppingCart, tono: 'text-success-600 bg-success-50' },
  compra: { icon: ShoppingBag, tono: 'text-primary-600 bg-primary-50' },
  ajuste: { icon: SlidersHorizontal, tono: 'text-warning-600 bg-warning-50' },
  cliente: { icon: UserPlus, tono: 'text-gray-600 bg-gray-100' },
};

const ETIQUETA_METODO = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia', MIXTO: 'Mixto' };

function DashboardPage() {
  const { usuario } = useAuth();
  const { cargando, error, datos } = useDashboardData();

  if (cargando) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-500">Cargando dashboard...</div>;
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-danger-600">No se pudo cargar el dashboard. Intenta recargar la página.</p>
      </Card>
    );
  }

  const maxVendido = Math.max(...datos.topArticulos.map((a) => a.cantidad), 1);
  const totalCobradoHoy = datos.porMetodoPago.reduce((acc, p) => acc + Number(p.monto), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          {usuario?.nombre ? `Hola, ${usuario.nombre.split(' ')[0]} — ` : ''}Resumen general de tu negocio
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          tono="primary"
          icono={<ShoppingCart size={18} />}
          etiqueta="Ventas del día"
          valor={formatoMoneda(datos.ventasHoy)}
          delta={
            datos.deltaVentas === null ? null : (
              <span className="inline-flex items-center gap-1">
                {datos.deltaVentas >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(datos.deltaVentas).toFixed(1)}% vs. ayer
              </span>
            )
          }
        />
        <StatCard
          tono="success"
          icono={<Wallet size={18} />}
          etiqueta="Caja actual"
          valor={formatoMoneda(datos.caja.total)}
          delta={datos.caja.abiertas > 0 ? `${datos.caja.abiertas} sesión(es) abierta(s)` : 'Sin cajas abiertas'}
        />
        <StatCard
          tono="warning"
          icono={<Package size={18} />}
          etiqueta="Artículos en stock"
          valor={datos.articulosConStock.toLocaleString('es-MX')}
          delta={datos.stockBajo.length > 0 ? `${datos.stockBajo.length} con stock bajo` : 'Stock saludable'}
        />
        <StatCard
          tono="danger"
          icono={<Users size={18} />}
          etiqueta="Clientes activos"
          valor={datos.clientesActivos.toLocaleString('es-MX')}
          delta={datos.clientesNuevosSemana > 0 ? `+${datos.clientesNuevosSemana} esta semana` : null}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Ventas de los últimos 7 días" className="lg:col-span-2">
          <TrendChart datos={datos.tendencia} />
        </Card>

        <Card title="Productos más vendidos">
          <ul className="space-y-3">
            {datos.topArticulos.length === 0 && <p className="text-sm text-gray-400">Sin ventas todavía.</p>}
            {datos.topArticulos.map((a) => (
              <li key={a.articulo?.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium text-gray-700">{a.articulo?.nombre}</span>
                  <span className="shrink-0 text-gray-500">{a.cantidad} uds.</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-primary-600"
                    style={{ width: `${(a.cantidad / maxVendido) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Movimientos recientes">
          <ul className="divide-y divide-gray-100">
            {datos.movimientos.length === 0 && <p className="text-sm text-gray-400">Sin actividad reciente.</p>}
            {datos.movimientos.map((m, i) => {
              const cfg = ICONO_MOVIMIENTO[m.tipo];
              const Icon = cfg.icon;
              return (
                <li key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cfg.tono}`}>
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{m.titulo}</p>
                    <p className="text-xs text-gray-400">{m.detalle || tiempoRelativo(m.fecha)}</p>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    {m.monto !== undefined && (
                      <p className="text-sm font-medium text-gray-700">{formatoMoneda(m.monto)}</p>
                    )}
                    {m.detalle && <p>{tiempoRelativo(m.fecha)}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Alertas">
          <ul className="space-y-3">
            {datos.stockBajo.slice(0, 3).map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-600">
                  <AlertTriangle size={15} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Stock bajo: {s.articulo.nombre}</p>
                  <p className="text-xs text-gray-400">Solo {Number(s.cantidad)} unidades disponibles</p>
                </div>
              </li>
            ))}
            <li className="flex items-start gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  datos.caja.abiertas > 0 ? 'bg-primary-50 text-primary-600' : 'bg-warning-50 text-warning-600'
                }`}
              >
                <Info size={15} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {datos.caja.abiertas > 0 ? 'Caja abierta' : 'Sin cajas abiertas'}
                </p>
                <p className="text-xs text-gray-400">
                  {datos.caja.abiertas > 0
                    ? `${datos.caja.abiertas} sesión(es) de caja en uso`
                    : 'Ningún turno de caja está abierto ahora'}
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600">
                <CheckCircle2 size={15} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Sistema funcionando</p>
                <p className="text-xs text-gray-400">Todos los servicios operativos</p>
              </div>
            </li>
          </ul>
        </Card>

        <Card title="Resumen de caja (hoy)">
          <ul className="divide-y divide-gray-100">
            {datos.porMetodoPago.map((p) => (
              <li key={p.metodo} className="flex items-center justify-between py-2 text-sm first:pt-0">
                <span className="text-gray-600">{ETIQUETA_METODO[p.metodo] || p.metodo}</span>
                <span className="font-medium text-gray-800">{formatoMoneda(p.monto)}</span>
              </li>
            ))}
            {datos.porMetodoPago.length === 0 && (
              <li className="py-2 text-sm text-gray-400">Sin cobros registrados hoy.</li>
            )}
            <li className="flex items-center justify-between rounded-lg bg-primary-50 px-3 py-2.5 mt-1 text-sm font-semibold text-primary-800">
              <span>Total</span>
              <span>{formatoMoneda(totalCobradoHoy)}</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

export default DashboardPage;
