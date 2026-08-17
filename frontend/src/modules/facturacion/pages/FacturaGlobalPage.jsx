import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listarVentasFacturables, crearFacturaAgrupada } from '../api/facturas.api';
import { listarSucursales } from '../../core/api/core.api';
import { listarClientes } from '../../clientes/api/clientes.api';
import ReceptorFiscalCampos, { RECEPTOR_VACIO, receptorDesdeCliente } from '../components/ReceptorFiscalCampos';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { formatoMoneda, formatoFecha } from '../../../shared/format';

const RECEPTOR_PUBLICO_GENERAL = {
  rfc: 'XAXX010101000',
  nombre: 'PÚBLICO EN GENERAL',
  regimenFiscal: '616',
  usoCfdi: 'S01',
  domicilioFiscalCp: '',
};

const MESES_OPCIONES = [
  ['01', 'Enero'], ['02', 'Febrero'], ['03', 'Marzo'], ['04', 'Abril'], ['05', 'Mayo'], ['06', 'Junio'],
  ['07', 'Julio'], ['08', 'Agosto'], ['09', 'Septiembre'], ['10', 'Octubre'], ['11', 'Noviembre'], ['12', 'Diciembre'],
];

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function FacturaGlobalPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState('GLOBAL'); // GLOBAL | CONSOLIDADA_CLIENTE
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState('');
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());

  const [ventas, setVentas] = useState(null);
  const [seleccionadas, setSeleccionadas] = useState(new Set());
  const [buscando, setBuscando] = useState(false);

  const [receptor, setReceptor] = useState(RECEPTOR_PUBLICO_GENERAL);
  const [cpExpedicion, setCpExpedicion] = useState('');
  const [periodicidad, setPeriodicidad] = useState('01');
  const [meses, setMeses] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [anio, setAnio] = useState(new Date().getFullYear());

  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [folioCreado, setFolioCreado] = useState('');

  useEffect(() => {
    listarSucursales().then((s) => {
      setSucursales(s);
      if (s.length === 1) setSucursalId(s[0].id);
    }).catch(() => {});
    listarClientes().then((c) => setClientes(c.filter((x) => !x.esGeneral && x.activo))).catch(() => {});
  }, []);

  function cambiarModo(nuevo) {
    setModo(nuevo);
    setVentas(null);
    setSeleccionadas(new Set());
    setError('');
    setReceptor(nuevo === 'GLOBAL' ? RECEPTOR_PUBLICO_GENERAL : RECEPTOR_VACIO);
  }

  async function buscarVentas(e) {
    e.preventDefault();
    setError('');
    if (!sucursalId) { setError('Elegí la sucursal.'); return; }
    if (modo === 'CONSOLIDADA_CLIENTE' && !clienteId) { setError('Elegí el cliente.'); return; }

    setBuscando(true);
    try {
      const params = { sucursalId };
      if (modo === 'GLOBAL') {
        params.soloPublicoGeneral = true;
        params.desde = desde;
        params.hasta = hasta;
      } else {
        params.clienteId = clienteId;
      }
      const resultado = await listarVentasFacturables(params);
      setVentas(resultado);
      setSeleccionadas(new Set(resultado.map((v) => v.id)));
      if (modo === 'CONSOLIDADA_CLIENTE') {
        const cliente = clientes.find((c) => c.id === clienteId);
        setReceptor(receptorDesdeCliente(cliente));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron buscar las ventas.');
    } finally {
      setBuscando(false);
    }
  }

  function alternarSeleccion(id) {
    setSeleccionadas((s) => {
      const nuevo = new Set(s);
      if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
      return nuevo;
    });
  }

  const totalSeleccionado = (ventas || [])
    .filter((v) => seleccionadas.has(v.id))
    .reduce((acc, v) => acc + Number(v.total), 0);

  function actualizarReceptor(campo, valor) {
    setReceptor((r) => ({ ...r, [campo]: valor }));
  }

  async function confirmar(e) {
    e.preventDefault();
    setError('');
    if (seleccionadas.size === 0) { setError('Seleccioná al menos una venta.'); return; }

    setGuardando(true);
    try {
      const receptorFinal = modo === 'GLOBAL' ? { ...receptor, domicilioFiscalCp: cpExpedicion } : receptor;
      const factura = await crearFacturaAgrupada({
        tipo: modo,
        sucursalId,
        ventaIds: [...seleccionadas],
        receptor: receptorFinal,
        informacionGlobal: modo === 'GLOBAL' ? { periodicidad, meses, anio: Number(anio) } : undefined,
      });
      setFolioCreado(factura);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la factura.');
    } finally {
      setGuardando(false);
    }
  }

  if (folioCreado) {
    const timbrada = folioCreado.estado === 'TIMBRADA';
    const conError = folioCreado.estado === 'ERROR';
    return (
      <Card>
        <div className="space-y-3 text-center">
          <h1 className="text-xl font-bold text-gray-900">
            Factura {folioCreado.folio} {timbrada ? 'timbrada ante el SAT' : 'creada'}
          </h1>
          {timbrada && <p className="font-mono text-xs text-gray-400">UUID {folioCreado.uuid}</p>}
          {conError && (
            <p className="text-sm text-danger-700">
              No se pudo timbrar: {folioCreado.errorTimbrado || 'error desconocido'}. Podés reintentarlo desde Facturación.
            </p>
          )}
          {!timbrada && !conError && (
            <p className="text-sm text-gray-500">Queda en estado Pendiente hasta que se timbre ante el SAT.</p>
          )}
          <Button onClick={() => navigate('/facturacion')}>Ver facturas</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Factura global / consolidada</h1>
        <p className="text-sm text-gray-500">Agrupa varias ventas del POS que todavía no fueron facturadas individualmente.</p>
      </div>

      <div className="flex gap-2">
        <Button variant={modo === 'GLOBAL' ? 'primary' : 'secondary'} onClick={() => cambiarModo('GLOBAL')}>
          Público en general
        </Button>
        <Button variant={modo === 'CONSOLIDADA_CLIENTE' ? 'primary' : 'secondary'} onClick={() => cambiarModo('CONSOLIDADA_CLIENTE')}>
          Cliente identificado
        </Button>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}

      <Card title="Buscar ventas sin facturar">
        <form onSubmit={buscarVentas} className="flex flex-wrap items-end gap-3">
          <Select id="sucursalGlobal" label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} required className="min-w-[180px]">
            <option value="">Selecciona...</option>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Select>

          {modo === 'GLOBAL' ? (
            <>
              <Input id="desdeGlobal" label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              <Input id="hastaGlobal" label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </>
          ) : (
            <Select id="clienteConsolidada" label="Cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)} required className="min-w-[220px]">
              <option value="">Selecciona...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          )}

          <Button type="submit" variant="secondary" disabled={buscando}>{buscando ? 'Buscando…' : 'Buscar ventas'}</Button>
        </form>
      </Card>

      {ventas !== null && (
        <>
          <Card title={`Ventas encontradas (${ventas.length})`}>
            <Table columnas={['', 'Folio', 'Cliente', 'Fecha', 'Total']}>
              {ventas.length === 0 && <TablaVacia colSpan={5} />}
              {ventas.map((v) => (
                <Fila key={v.id}>
                  <Celda>
                    <input
                      type="checkbox"
                      checked={seleccionadas.has(v.id)}
                      onChange={() => alternarSeleccion(v.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </Celda>
                  <Celda>{v.folio}</Celda>
                  <Celda>{v.cliente?.nombre}</Celda>
                  <Celda>{formatoFecha(v.creadoEn)}</Celda>
                  <Celda>{formatoMoneda(v.total)}</Celda>
                </Fila>
              ))}
            </Table>
            {ventas.length > 0 && (
              <p className="mt-3 text-right text-sm text-gray-600">
                Seleccionadas: {seleccionadas.size} — Total: <strong>{formatoMoneda(totalSeleccionado)}</strong>
              </p>
            )}
          </Card>

          {ventas.length > 0 && (
            <Card title="Datos del CFDI">
              <form onSubmit={confirmar} className="space-y-5">
                {modo === 'GLOBAL' ? (
                  <>
                    <p className="text-sm text-gray-500">
                      Receptor fijo: <strong>{RECEPTOR_PUBLICO_GENERAL.nombre}</strong> ({RECEPTOR_PUBLICO_GENERAL.rfc})
                    </p>
                    <Input
                      id="cpExpedicionGlobal"
                      label="Código postal (domicilio fiscal del receptor genérico)"
                      value={cpExpedicion}
                      onChange={(e) => setCpExpedicion(e.target.value)}
                      required
                      className="max-w-xs"
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <Select id="periodicidadGlobal" label="Periodicidad" value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value)}>
                        <option value="01">Diario</option>
                        <option value="02">Semanal</option>
                        <option value="03">Quincenal</option>
                        <option value="04">Mensual</option>
                        <option value="05">Bimestral</option>
                      </Select>
                      <Select id="mesesGlobal" label="Mes" value={meses} onChange={(e) => setMeses(e.target.value)}>
                        {MESES_OPCIONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </Select>
                      <Input id="anioGlobal" label="Año" type="number" value={anio} onChange={(e) => setAnio(e.target.value)} />
                    </div>
                  </>
                ) : (
                  <ReceptorFiscalCampos value={receptor} onChange={actualizarReceptor} idPrefix="consolidada" />
                )}

                <div className="flex justify-end">
                  <Button type="submit" disabled={guardando}>{guardando ? 'Creando…' : 'Crear factura'}</Button>
                </div>
              </form>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default FacturaGlobalPage;
