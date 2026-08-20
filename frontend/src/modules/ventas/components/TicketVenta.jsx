import { useAuth } from '../../../shared/context/AuthContext';
import { formatoMoneda, formatoFecha } from '../../../shared/format';

const METODO_LABEL = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia' };

// Recibo angosto tipo ticket térmico (80mm). Se usa tanto para imprimir apenas se confirma
// una venta en VentasPage (con `cambio`, que no se persiste en el backend) como para
// reimprimir una venta ya existente desde VentasHistorialPage (sin `cambio`).
function TicketVenta({ venta, cambio }) {
  const { empresa } = useAuth();
  if (!venta) return null;

  // El RFC emisor real de esta venta es el de su sucursal si tiene uno propio, si no el de la
  // empresa -- mismo criterio de resolución que facturas.service.js#resolverEmisor. Antes acá
  // siempre se mostraba empresa.rfc a secas, así que una empresa con RFC distinto por sucursal
  // imprimía el RFC equivocado en el ticket -- encontrado al agregar el RFC como factor de
  // verificación en el portal público de autofacturación (que sí valida contra el RFC real de
  // la sucursal): el cliente nunca podría teclear el que ve impreso porque no coincidía.
  const rfcTicket = venta.sucursal?.rfc || empresa?.rfc;

  const descuentoTotal = (venta.detalles || []).reduce((acc, d) => acc + Number(d.descuentoMonto || 0), 0);

  return (
    <div id="ticket-imprimible" className="mx-auto w-[80mm] bg-white p-3 font-mono text-xs leading-relaxed text-gray-900">
      <div className="text-center">
        <p className="text-sm font-bold">{empresa?.nombreComercial}</p>
        {rfcTicket && <p>RFC: {rfcTicket}</p>}
        {empresa?.telefono && <p>Tel: {empresa.telefono}</p>}
        <p className="mt-1">{venta.sucursal?.nombre}</p>
        {venta.sucursal?.direccion && <p>{venta.sucursal.direccion}</p>}
      </div>

      <div className="my-2 border-t border-dashed border-gray-500" />

      <p>Folio: {venta.folio}</p>
      <p>Fecha: {formatoFecha(venta.creadoEn)}</p>
      <p>Cliente: {venta.cliente?.nombre}</p>
      {venta.estado === 'CANCELADA' && (
        <p className="mt-1 text-center font-bold">** VENTA CANCELADA **</p>
      )}

      <div className="my-2 border-t border-dashed border-gray-500" />

      {venta.detalles?.map((d) => {
        const descuentoMonto = Number(d.descuentoMonto || 0);
        // Un descuento manual (cargado directo en la venta) no queda ligado a un registro de
        // catálogo, así que no tiene d.descuento/d.promocion — se etiqueta genérico.
        const nombreDescuento =
          d.descuento?.nombre || d.promocion?.nombre || d.descuentoNombre || d.promocionNombre ||
          (descuentoMonto > 0 ? 'Descuento manual' : null);
        return (
          <div key={d.id || d.articuloId} className="mb-1">
            <p className="truncate">{d.articulo?.nombre || d.articuloId}</p>
            <div className="flex justify-between">
              <span>{Number(d.cantidad)} x {formatoMoneda(d.precio)}</span>
              <span>{formatoMoneda(Number(d.cantidad) * Number(d.precio) - descuentoMonto)}</span>
            </div>
            {descuentoMonto > 0 && (
              <div className="flex justify-between text-[10px] text-gray-600">
                <span>{nombreDescuento === 'Descuento manual' ? nombreDescuento : `Descuento: ${nombreDescuento}`}</span>
                <span>-{formatoMoneda(descuentoMonto)}</span>
              </div>
            )}
          </div>
        );
      })}

      <div className="my-2 border-t border-dashed border-gray-500" />

      {descuentoTotal > 0 && (
        <div className="flex justify-between"><span>Descuento</span><span>-{formatoMoneda(descuentoTotal)}</span></div>
      )}
      <div className="flex justify-between"><span>Subtotal</span><span>{formatoMoneda(venta.subtotal)}</span></div>
      <div className="flex justify-between"><span>Impuestos</span><span>{formatoMoneda(venta.impuestos)}</span></div>
      <div className="flex justify-between text-sm font-bold"><span>Total</span><span>{formatoMoneda(venta.total)}</span></div>

      <div className="my-2 border-t border-dashed border-gray-500" />

      {venta.pagos?.map((p) => (
        <div key={p.id || p.metodo} className="flex justify-between">
          <span>{METODO_LABEL[p.metodo] || p.metodo}</span>
          <span>{formatoMoneda(p.monto)}</span>
        </div>
      ))}
      {cambio > 0 && (
        <div className="flex justify-between font-semibold">
          <span>Cambio</span><span>{formatoMoneda(cambio)}</span>
        </div>
      )}

      <p className="mt-3 text-center">¡Gracias por su compra!</p>
    </div>
  );
}

export default TicketVenta;
