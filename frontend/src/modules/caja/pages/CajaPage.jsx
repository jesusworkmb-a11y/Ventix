import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  listarCajas,
  crearCaja,
  listarSesiones,
  obtenerSesion,
  abrirSesion,
  cerrarSesion,
  registrarMovimiento,
} from '../api/caja.api';
import { listarSucursales } from '../../core/api/core.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Badge from '../../../shared/ui/Badge';
import Modal from '../../../shared/ui/Modal';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { formatoMoneda } from '../../../shared/format';

const TONO_MOVIMIENTO = { INGRESO: 'success', VENTA: 'success', RETIRO: 'danger', DEVOLUCION: 'danger' };

function CajaPage() {
  const [cajas, setCajas] = useState([]);
  const [cajaId, setCajaId] = useState('');
  const [sesion, setSesion] = useState(null);
  const [error, setError] = useState('');
  const [cierre, setCierre] = useState(null);

  const [fondoInicial, setFondoInicial] = useState('');
  const [movTipo, setMovTipo] = useState('INGRESO');
  const [movMonto, setMovMonto] = useState('');
  const [movMotivo, setMovMotivo] = useState('');
  const [saldoReal, setSaldoReal] = useState('');

  const [sucursales, setSucursales] = useState([]);
  const [modalCajaAbierto, setModalCajaAbierto] = useState(false);
  const [nuevaCajaNombre, setNuevaCajaNombre] = useState('');
  const [nuevaCajaSucursalId, setNuevaCajaSucursalId] = useState('');
  const [errorNuevaCaja, setErrorNuevaCaja] = useState('');

  function cargarCajas() {
    return listarCajas().then((data) => {
      setCajas(data);
      if (data.length) setCajaId((actual) => actual || data[0].id);
      return data;
    });
  }

  useEffect(() => {
    cargarCajas().catch(() => {});
    listarSucursales()
      .then((data) => {
        setSucursales(data);
        setNuevaCajaSucursalId((actual) => actual || data[0]?.id || '');
      })
      .catch(() => {});
  }, []);

  async function handleCrearCaja(e) {
    e.preventDefault();
    setErrorNuevaCaja('');
    try {
      const caja = await crearCaja({ sucursalId: nuevaCajaSucursalId, nombre: nuevaCajaNombre });
      setNuevaCajaNombre('');
      setModalCajaAbierto(false);
      await cargarCajas();
      setCajaId(caja.id);
    } catch (err) {
      setErrorNuevaCaja(err.response?.data?.error || 'No se pudo crear la caja.');
    }
  }

  useEffect(() => {
    if (cajaId) cargarSesionAbierta(cajaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cajaId]);

  async function cargarSesionAbierta(id) {
    setError('');
    try {
      const abiertas = await listarSesiones({ cajaId: id, abierta: 'true' });
      if (abiertas.length) {
        const detalle = await obtenerSesion(abiertas[0].id);
        setSesion(detalle);
      } else {
        setSesion(null);
      }
    } catch (err) {
      setError('No se pudo cargar el estado de la caja.');
    }
  }

  async function handleAbrir(e) {
    e.preventDefault();
    setError('');
    setCierre(null);
    try {
      await abrirSesion({ cajaId, fondoInicial: Number(fondoInicial) });
      setFondoInicial('');
      cargarSesionAbierta(cajaId);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo abrir la sesión.');
    }
  }

  async function handleMovimiento(e) {
    e.preventDefault();
    setError('');
    try {
      await registrarMovimiento(sesion.id, {
        tipo: movTipo,
        monto: Number(movMonto),
        motivo: movMotivo || undefined,
      });
      setMovMonto('');
      setMovMotivo('');
      cargarSesionAbierta(cajaId);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar el movimiento.');
    }
  }

  async function handleCerrar(e) {
    e.preventDefault();
    setError('');
    try {
      const resultado = await cerrarSesion(sesion.id, { saldoReal: Number(saldoReal) });
      setCierre(resultado);
      setSesion(null);
      setSaldoReal('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cerrar la sesión.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Caja</h1>
        <p className="text-sm text-gray-500">Abrí y cerrá sesiones de caja, y registrá ingresos y retiros.</p>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
      {cierre && (
        <p className="rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">
          Sesión cerrada. Esperado: {formatoMoneda(cierre.saldoEsperado)} — Real: {formatoMoneda(cierre.saldoReal)} — Diferencia: {formatoMoneda(cierre.diferencia)}
        </p>
      )}

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          {cajas.length > 0 ? (
            <Select id="cajaSel" label="Caja" value={cajaId} onChange={(e) => setCajaId(e.target.value)} className="max-w-xs">
              {cajas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </Select>
          ) : (
            <p className="text-sm text-gray-500">No hay cajas registradas todavía.</p>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={() => setModalCajaAbierto(true)}>
            <Plus size={16} /> Nueva caja
          </Button>
        </div>
      </Card>

      <Modal abierto={modalCajaAbierto} onCerrar={() => setModalCajaAbierto(false)} titulo="Nueva caja" ancho="max-w-sm">
        {sucursales.length === 0 ? (
          <p className="text-sm text-gray-500">
            Primero necesitás al menos una sucursal (Configuración → Sucursales).
          </p>
        ) : (
          <form onSubmit={handleCrearCaja} className="flex flex-col gap-4">
            <Select
              id="nuevaCajaSucursal"
              label="Sucursal"
              value={nuevaCajaSucursalId}
              onChange={(e) => setNuevaCajaSucursalId(e.target.value)}
            >
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </Select>
            <Input
              id="nuevaCajaNombre"
              label="Nombre"
              value={nuevaCajaNombre}
              onChange={(e) => setNuevaCajaNombre(e.target.value)}
              required
            />
            {errorNuevaCaja && (
              <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{errorNuevaCaja}</p>
            )}
            <Button type="submit">Crear caja</Button>
          </form>
        )}
      </Modal>

      {cajaId && !sesion && (
        <Card title="Abrir sesión">
          <form onSubmit={handleAbrir} className="flex flex-wrap items-end gap-3">
            <Input
              id="fondoInicial"
              label="Fondo inicial"
              type="number"
              step="0.01"
              min="0"
              value={fondoInicial}
              onChange={(e) => setFondoInicial(e.target.value)}
              className="w-40"
              required
            />
            <Button type="submit">Abrir</Button>
          </form>
        </Card>
      )}

      {sesion && (
        <Card title="Sesión abierta">
          <p className="mb-4 text-sm text-gray-500">
            Fondo inicial: <span className="font-medium text-gray-700">{formatoMoneda(sesion.fondoInicial)}</span>
            {' · '}Abierta: {new Date(sesion.abiertaEn).toLocaleString()}
          </p>

          <Table columnas={['Tipo', 'Monto', 'Motivo']}>
            {sesion.movimientos.length === 0 && <TablaVacia colSpan={3} mensaje="Sin movimientos todavía." />}
            {sesion.movimientos.map((m) => (
              <Fila key={m.id}>
                <Celda><Badge tono={TONO_MOVIMIENTO[m.tipo] || 'gray'}>{m.tipo}</Badge></Celda>
                <Celda>{formatoMoneda(m.monto)}</Celda>
                <Celda>{m.motivo || '—'}</Celda>
              </Fila>
            ))}
          </Table>

          <form onSubmit={handleMovimiento} className="mt-5 flex flex-wrap items-end gap-3">
            <Select id="movTipo" label="Tipo" value={movTipo} onChange={(e) => setMovTipo(e.target.value)}>
              <option value="INGRESO">Ingreso</option>
              <option value="RETIRO">Retiro</option>
            </Select>
            <Input
              id="movMonto"
              label="Monto"
              type="number"
              step="0.01"
              min="0"
              value={movMonto}
              onChange={(e) => setMovMonto(e.target.value)}
              className="w-32"
              required
            />
            <Input
              id="movMotivo"
              label="Motivo (opcional)"
              value={movMotivo}
              onChange={(e) => setMovMotivo(e.target.value)}
            />
            <Button type="submit" variant="secondary">Registrar</Button>
          </form>

          <hr className="my-5 border-gray-100" />

          <form onSubmit={handleCerrar} className="flex flex-wrap items-end gap-3">
            <Input
              id="saldoReal"
              label="Saldo real al cerrar"
              type="number"
              step="0.01"
              min="0"
              value={saldoReal}
              onChange={(e) => setSaldoReal(e.target.value)}
              className="w-40"
              required
            />
            <Button type="submit" variant="danger">Cerrar sesión</Button>
          </form>
        </Card>
      )}
    </div>
  );
}

export default CajaPage;
