import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import {
  obtenerEmpresaPublica, buscarVentaPublica, facturarPublico, buscarCatalogoSatPublico,
} from '../api/facturacionPublica.api';
import ReceptorFiscalCampos, { RECEPTOR_VACIO } from '../../facturacion/components/ReceptorFiscalCampos';
import Card from '../../../shared/ui/Card';
import Input from '../../../shared/ui/Input';
import Button from '../../../shared/ui/Button';
import { formatoMoneda, formatoFecha } from '../../../shared/format';

// Portal público de autofacturación (Fase E): sin login, el cliente ingresa el folio + monto +
// RFC de la empresa/sucursal emisora (impreso en su ticket) para encontrarlo -- monto y RFC
// actúan como segundo/tercer factor livianos, ver portalPublico.service.js en el backend -- y
// completa sus datos fiscales para generar el CFDI. Tres pasos en una sola pantalla: buscar
// ticket -> completar receptor -> listo.
function PortalAutofacturacionPage() {
  const { slug } = useParams();
  const [empresa, setEmpresa] = useState(null);
  const [portalNoDisponible, setPortalNoDisponible] = useState(false);

  const [folio, setFolio] = useState('');
  const [total, setTotal] = useState('');
  const [rfcEmisor, setRfcEmisor] = useState('');
  const [venta, setVenta] = useState(null);
  const [receptor, setReceptor] = useState(RECEPTOR_VACIO);
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [facturando, setFacturando] = useState(false);
  const [folioCreado, setFolioCreado] = useState('');

  useEffect(() => {
    obtenerEmpresaPublica(slug)
      .then(setEmpresa)
      .catch(() => setPortalNoDisponible(true));
  }, [slug]);

  async function buscarTicket(e) {
    e.preventDefault();
    setError('');
    if (!folio.trim() || !total || !rfcEmisor.trim()) {
      setError('Completá el folio, el monto y el RFC del ticket.');
      return;
    }
    setBuscando(true);
    try {
      const encontrada = await buscarVentaPublica(slug, { folio: folio.trim(), total: Number(total), rfcEmisor: rfcEmisor.trim() });
      setVenta(encontrada);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo buscar el ticket.');
    } finally {
      setBuscando(false);
    }
  }

  async function confirmarFactura(e) {
    e.preventDefault();
    setError('');
    setFacturando(true);
    try {
      const factura = await facturarPublico(slug, { folio: folio.trim(), total: Number(total), rfcEmisor: rfcEmisor.trim(), receptor });
      setFolioCreado(factura);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo generar la factura.');
    } finally {
      setFacturando(false);
    }
  }

  if (portalNoDisponible) {
    return (
      <PortalLayout>
        <p className="text-center text-sm text-gray-500">
          Este portal de autofacturación no está disponible. Verificá el link con el negocio.
        </p>
      </PortalLayout>
    );
  }

  if (folioCreado) {
    return (
      <PortalLayout empresa={empresa}>
        <div className="space-y-3 text-center">
          <h1 className="text-xl font-bold text-gray-900">
            Factura {folioCreado.folio} {folioCreado.estado === 'TIMBRADA' ? 'timbrada' : 'creada'}
          </h1>
          {folioCreado.estado === 'TIMBRADA' && (
            <p className="text-sm text-gray-500">
              Tu factura ya fue timbrada ante el SAT. Guardá este folio como comprobante.
            </p>
          )}
          {folioCreado.estado === 'ERROR' && (
            <p className="text-sm text-danger-700">
              Registramos tu factura pero no pudimos timbrarla automáticamente. Guardá este folio y contactá al negocio para que la revisen.
            </p>
          )}
          {folioCreado.estado !== 'TIMBRADA' && folioCreado.estado !== 'ERROR' && (
            <p className="text-sm text-gray-500">
              Tu factura quedó registrada y queda en estado Pendiente hasta que se timbre ante el SAT.
              Guardá este folio como comprobante.
            </p>
          )}
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout empresa={empresa}>
      {error && <p className="mb-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}

      {!venta && (
        <form onSubmit={buscarTicket} className="space-y-4">
          <p className="text-sm text-gray-500">Ingresá el folio y el monto total de tu ticket para facturarlo.</p>
          <Input id="folio" label="Folio del ticket" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="VTA-MAT-000123" required autoFocus />
          <Input id="total" label="Monto total" type="number" step="0.01" min="0" value={total} onChange={(e) => setTotal(e.target.value)} required />
          <Input id="rfcEmisor" label="RFC de la empresa (impreso en tu ticket)" value={rfcEmisor} onChange={(e) => setRfcEmisor(e.target.value)} placeholder="XAXX010101000" required />
          <Button type="submit" disabled={buscando} className="w-full">{buscando ? 'Buscando…' : 'Buscar ticket'}</Button>
        </form>
      )}

      {venta && (
        <form onSubmit={confirmarFactura} className="space-y-5">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
            <p className="font-medium text-gray-800">Ticket {venta.folio}</p>
            <p className="text-gray-500">{formatoFecha(venta.fecha)} · {formatoMoneda(venta.total)}</p>
          </div>

          <ReceptorFiscalCampos value={receptor} onChange={(campo, valor) => setReceptor((r) => ({ ...r, [campo]: valor }))} idPrefix="portal" buscarFn={buscarCatalogoSatPublico} />

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => { setVenta(null); setError(''); }}>Volver</Button>
            <Button type="submit" disabled={facturando} className="flex-1">{facturando ? 'Generando…' : 'Facturar'}</Button>
          </div>
        </form>
      )}
    </PortalLayout>
  );
}

function PortalLayout({ empresa, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2">
          {empresa?.logoUrl ? (
            <img src={empresa.logoUrl} alt="" className="h-11 w-11 rounded-xl object-cover" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 text-white">
              <Receipt size={22} />
            </div>
          )}
          <span className="text-xl font-bold text-gray-900">{empresa?.nombreComercial || 'Autofacturación'}</span>
        </div>
        <Card>{children}</Card>
      </div>
    </div>
  );
}

export default PortalAutofacturacionPage;
