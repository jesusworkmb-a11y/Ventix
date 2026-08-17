// Mapea el modelo interno de Factura (ya persistido, con sus detalles+impuestos) al JSON exacto
// que espera Facturama en modo Multiemisor. Separado de facturas.service.js porque es lógica de
// traducción hacia un formato externo, no de negocio propio de Ventix.

const CLAVE_A_NOMBRE_IMPUESTO = { '001': 'ISR', '002': 'IVA', '003': 'IEPS' };

function itemDesdeDetalle(d) {
  return {
    ProductCode: d.claveProdServSat,
    UnitCode: d.claveUnidadSat,
    Description: d.descripcion,
    Quantity: Number(d.cantidad),
    UnitPrice: Number(d.valorUnitario),
    Subtotal: Number(d.importe),
    Discount: Number(d.descuento || 0),
    TaxObject: d.objetoImpuesto,
    Taxes: d.impuestos.map((imp) => ({
      Name: CLAVE_A_NOMBRE_IMPUESTO[imp.impuestoClaveSat] || 'IVA',
      Base: Number(imp.base),
      Rate: imp.tasaOCuota != null ? Number(imp.tasaOCuota) : undefined,
      Total: Number(imp.importe || 0),
      IsRetention: imp.tipo === 'RETENCION',
    })),
    Total: Number(d.importe) - Number(d.descuento || 0)
      + d.impuestos.filter((i) => i.tipo === 'TRASLADO').reduce((acc, i) => acc + Number(i.importe || 0), 0)
      - d.impuestos.filter((i) => i.tipo === 'RETENCION').reduce((acc, i) => acc + Number(i.importe || 0), 0),
  };
}

function cfdiDesdeFactura(factura) {
  const cfdi = {
    CfdiType: 'I',
    PaymentForm: factura.formaPago,
    PaymentMethod: factura.metodoPago,
    ExpeditionPlace: factura.lugarExpedicion,
    Currency: factura.moneda,
    Folio: factura.folio,
    Issuer: {
      Rfc: factura.rfcEmisor,
      Name: factura.razonSocialEmisor,
      FiscalRegime: factura.regimenFiscalEmisor,
    },
    Receiver: {
      Rfc: factura.rfcReceptor,
      Name: factura.nombreReceptor,
      CfdiUse: factura.usoCfdi,
      FiscalRegime: factura.regimenFiscalReceptor,
      TaxZipCode: factura.domicilioFiscalReceptorCp,
    },
    Items: factura.detalles.map(itemDesdeDetalle),
  };

  // CFDI 4.0 exige este nodo cuando el receptor es el RFC genérico de público en general
  // (facturas GLOBAL) -- confirmado a mano contra el sandbox, el PAC rechaza sin esto.
  if (factura.informacionGlobalPeriodicidad) {
    cfdi.GlobalInformation = {
      Periodicity: factura.informacionGlobalPeriodicidad,
      Months: factura.informacionGlobalMeses,
      Year: factura.informacionGlobalAnio,
    };
  }

  return cfdi;
}

module.exports = { cfdiDesdeFactura };
