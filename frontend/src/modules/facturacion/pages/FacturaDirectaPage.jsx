import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { crearFacturaDirecta } from '../api/facturas.api';
import { listarSucursales } from '../../core/api/core.api';
import ReceptorFiscalCampos, { RECEPTOR_VACIO } from '../components/ReceptorFiscalCampos';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import SelectorCatalogoSat from '../../../shared/ui/SelectorCatalogoSat';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';
import { formatoMoneda } from '../../../shared/format';

const OBJETO_IMPUESTO_OPCIONES = [
  { value: '02', label: '02 — Sí objeto de impuesto' },
  { value: '01', label: '01 — No objeto de impuesto' },
  { value: '03', label: '03 — Sí objeto, no obligado al desglose' },
  { value: '04', label: '04 — Sí objeto, no causa impuesto' },
];

const CONCEPTO_VACIO = {
  claveProdServSat: null,
  claveUnidadSat: null,
  descripcion: '',
  cantidad: '1',
  valorUnitario: '',
  descuento: '0',
  objetoImpuesto: '02',
  impuestoClaveSat: '002',
  tipoFactorSat: 'Tasa',
  tasaOCuota: '0.16',
};

function importeConcepto(c) {
  const importe = Number(c.cantidad || 0) * Number(c.valorUnitario || 0) - Number(c.descuento || 0);
  if (c.objetoImpuesto !== '02' || c.tipoFactorSat === 'Exento') return { importe, impuesto: 0 };
  const impuesto = importe * Number(c.tasaOCuota || 0);
  return { importe, impuesto };
}

function FacturaDirectaPage() {
  const navigate = useNavigate();
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState('');
  const [receptor, setReceptor] = useState(RECEPTOR_VACIO);
  const [formaPago, setFormaPago] = useState(null);
  const [metodoPago, setMetodoPago] = useState('PUE');
  const [conceptoForm, setConceptoForm] = useState(CONCEPTO_VACIO);
  const [conceptos, setConceptos] = useState([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [folioCreado, setFolioCreado] = useState('');

  useEffect(() => {
    listarSucursales().then((s) => {
      setSucursales(s);
      if (s.length === 1) setSucursalId(s[0].id);
    }).catch(() => {});
  }, []);

  function actualizarReceptor(campo, valor) {
    setReceptor((r) => ({ ...r, [campo]: valor }));
  }

  function agregarConcepto(e) {
    e.preventDefault();
    if (!conceptoForm.claveProdServSat || !conceptoForm.claveUnidadSat) {
      setError('Elegí la clave de producto/servicio y la clave de unidad SAT.');
      return;
    }
    if (!conceptoForm.descripcion || !conceptoForm.valorUnitario) {
      setError('Completá descripción y valor unitario.');
      return;
    }
    setError('');
    setConceptos((c) => [...c, conceptoForm]);
    setConceptoForm(CONCEPTO_VACIO);
  }

  function quitarConcepto(index) {
    setConceptos((c) => c.filter((_, i) => i !== index));
  }

  const totales = conceptos.reduce((acc, c) => {
    const { importe, impuesto } = importeConcepto(c);
    return { subtotal: acc.subtotal + importe, impuestos: acc.impuestos + impuesto };
  }, { subtotal: 0, impuestos: 0 });
  const total = totales.subtotal + totales.impuestos;

  async function confirmar(e) {
    e.preventDefault();
    setError('');
    if (!sucursalId) { setError('Elegí la sucursal de expedición.'); return; }
    if (conceptos.length === 0) { setError('Agregá al menos un concepto.'); return; }
    if (!formaPago) { setError('Elegí la forma de pago.'); return; }

    setGuardando(true);
    try {
      const factura = await crearFacturaDirecta({
        sucursalId,
        receptor,
        formaPago,
        metodoPago,
        conceptos: conceptos.map((c) => ({
          claveProdServSat: c.claveProdServSat,
          claveUnidadSat: c.claveUnidadSat,
          descripcion: c.descripcion,
          cantidad: Number(c.cantidad),
          valorUnitario: Number(c.valorUnitario),
          descuento: Number(c.descuento || 0),
          objetoImpuesto: c.objetoImpuesto,
          impuesto: c.objetoImpuesto === '02' ? {
            impuestoClaveSat: c.impuestoClaveSat,
            tipoFactorSat: c.tipoFactorSat,
            tasaOCuota: c.tipoFactorSat === 'Exento' ? undefined : Number(c.tasaOCuota),
          } : undefined,
        })),
      });
      setFolioCreado(factura.folio);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la factura.');
    } finally {
      setGuardando(false);
    }
  }

  if (folioCreado) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="space-y-3 text-center">
            <h1 className="text-xl font-bold text-gray-900">Factura {folioCreado} creada</h1>
            <p className="text-sm text-gray-500">Queda en estado Pendiente hasta que se integre el timbrado ante el SAT.</p>
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="secondary" onClick={() => { setFolioCreado(''); setConceptos([]); setReceptor(RECEPTOR_VACIO); }}>
                Crear otra
              </Button>
              <Button onClick={() => navigate('/facturacion')}>Ver facturas</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Factura directa</h1>
        <p className="text-sm text-gray-500">Emisión libre de CFDI, sin depender de una venta previa del POS.</p>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}

      <Card title="Sucursal y receptor">
        <div className="space-y-4">
          <Select
            id="sucursalDirecta"
            label="Sucursal de expedición"
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            required
            className="max-w-xs"
          >
            <option value="">Selecciona...</option>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Select>
          <ReceptorFiscalCampos value={receptor} onChange={actualizarReceptor} idPrefix="directa" />
        </div>
      </Card>

      <Card title="Conceptos">
        <form onSubmit={agregarConcepto} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectorCatalogoSat
            id="conceptoClaveProdServ"
            tipo="ClaveProdServ"
            label="Clave prod/serv SAT"
            value={conceptoForm.claveProdServSat}
            onChange={(v) => setConceptoForm((f) => ({ ...f, claveProdServSat: v }))}
          />
          <SelectorCatalogoSat
            id="conceptoClaveUnidad"
            tipo="ClaveUnidad"
            label="Clave unidad SAT"
            value={conceptoForm.claveUnidadSat}
            onChange={(v) => setConceptoForm((f) => ({ ...f, claveUnidadSat: v }))}
          />
          <Input
            id="conceptoDescripcion"
            label="Descripción"
            value={conceptoForm.descripcion}
            onChange={(e) => setConceptoForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
          <Input
            id="conceptoCantidad"
            label="Cantidad"
            type="number"
            step="0.01"
            min="0.01"
            value={conceptoForm.cantidad}
            onChange={(e) => setConceptoForm((f) => ({ ...f, cantidad: e.target.value }))}
          />
          <Input
            id="conceptoValorUnitario"
            label="Valor unitario"
            type="number"
            step="0.01"
            min="0"
            value={conceptoForm.valorUnitario}
            onChange={(e) => setConceptoForm((f) => ({ ...f, valorUnitario: e.target.value }))}
          />
          <Input
            id="conceptoDescuento"
            label="Descuento (opcional)"
            type="number"
            step="0.01"
            min="0"
            value={conceptoForm.descuento}
            onChange={(e) => setConceptoForm((f) => ({ ...f, descuento: e.target.value }))}
          />
          <Select
            id="conceptoObjetoImpuesto"
            label="Objeto de impuesto"
            value={conceptoForm.objetoImpuesto}
            onChange={(e) => setConceptoForm((f) => ({ ...f, objetoImpuesto: e.target.value }))}
          >
            {OBJETO_IMPUESTO_OPCIONES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          {conceptoForm.objetoImpuesto === '02' && (
            <>
              <Select
                id="conceptoImpuestoClave"
                label="Impuesto"
                value={conceptoForm.impuestoClaveSat}
                onChange={(e) => setConceptoForm((f) => ({ ...f, impuestoClaveSat: e.target.value }))}
              >
                <option value="002">IVA (002)</option>
                <option value="003">IEPS (003)</option>
                <option value="001">ISR (001)</option>
              </Select>
              <Select
                id="conceptoTipoFactor"
                label="Tipo de factor"
                value={conceptoForm.tipoFactorSat}
                onChange={(e) => setConceptoForm((f) => ({ ...f, tipoFactorSat: e.target.value }))}
              >
                <option value="Tasa">Tasa</option>
                <option value="Cuota">Cuota</option>
                <option value="Exento">Exento</option>
              </Select>
              {conceptoForm.tipoFactorSat !== 'Exento' && (
                <Input
                  id="conceptoTasaOCuota"
                  label="Tasa (ej. 0.16) / cuota"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={conceptoForm.tasaOCuota}
                  onChange={(e) => setConceptoForm((f) => ({ ...f, tasaOCuota: e.target.value }))}
                />
              )}
            </>
          )}
          <div className="sm:col-span-3">
            <Button type="submit" variant="secondary">Agregar concepto</Button>
          </div>
        </form>

        <div className="mt-5">
          <Table columnas={['Descripción', 'Cant.', 'V. unitario', 'Importe', '']}>
            {conceptos.length === 0 && <TablaVacia colSpan={5} />}
            {conceptos.map((c, i) => {
              const { importe } = importeConcepto(c);
              return (
                <Fila key={i}>
                  <Celda>{c.descripcion}</Celda>
                  <Celda>{c.cantidad}</Celda>
                  <Celda>{formatoMoneda(c.valorUnitario)}</Celda>
                  <Celda>{formatoMoneda(importe)}</Celda>
                  <Celda className="text-right">
                    <button type="button" onClick={() => quitarConcepto(i)} className="text-gray-400 hover:text-danger-600">
                      <Trash2 size={16} />
                    </button>
                  </Celda>
                </Fila>
              );
            })}
          </Table>
        </div>
      </Card>

      <Card title="Pago y confirmación">
        <form onSubmit={confirmar} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectorCatalogoSat
              id="formaPagoDirecta"
              tipo="FormaPago"
              label="Forma de pago"
              value={formaPago}
              onChange={setFormaPago}
              required
            />
            <Select
              id="metodoPagoDirecta"
              label="Método de pago"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
            >
              <option value="PUE">PUE — Pago en una sola exhibición</option>
              <option value="PPD">PPD — Pago en parcialidades o diferido</option>
            </Select>
          </div>

          <div className="flex justify-end gap-6 border-t border-gray-100 pt-4 text-sm">
            <span>Subtotal: <strong>{formatoMoneda(totales.subtotal)}</strong></span>
            <span>Impuestos: <strong>{formatoMoneda(totales.impuestos)}</strong></span>
            <span>Total: <strong>{formatoMoneda(total)}</strong></span>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={guardando}>{guardando ? 'Creando…' : 'Crear factura'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default FacturaDirectaPage;
