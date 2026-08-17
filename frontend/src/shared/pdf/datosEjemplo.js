// Dataset falso para el botón "Vista previa" de EmpresaPage — permite comparar las 6
// plantillas con datos representativos sin pegarle al backend ni depender de que ya exista
// una cotización/compra/factura real.
export function construirDatosEjemplo(empresa) {
  const conceptos = [
    {
      codigo: 'ABC-001', descripcion: 'Playera algodón premium (talla M)', cantidad: 3, unidad: 'Pieza',
      precioUnitario: 249, descuento: 0, impuestoTexto: '16%', importe: 866.52,
    },
    {
      codigo: 'ABC-014', descripcion: 'Sudadera con capucha', cantidad: 1, unidad: 'Pieza',
      precioUnitario: 599, descuento: 50, impuestoTexto: '16%', importe: 636.84,
    },
    {
      codigo: 'ABC-022', descripcion: 'Gorra bordada edición especial', cantidad: 2, unidad: 'Pieza',
      precioUnitario: 189, descuento: 0, impuestoTexto: '16%', importe: 438.48,
    },
  ];
  const subtotal = 1687;
  const descuentoTotal = 50;
  const impuestos = 254.88;
  const total = subtotal - descuentoTotal + impuestos;

  return {
    tipoDocumento: 'COTIZACION',
    tituloDocumento: 'COTIZACIÓN',
    folio: 'COT-EJEMPLO-001',
    fecha: new Date().toISOString(),
    estatus: { texto: 'Vigente', tono: 'exito' },
    empresa,
    contraparte: {
      etiqueta: 'Cliente',
      nombre: 'Comercializadora Ejemplo S.A. de C.V.',
      rfc: 'XAXX010101000',
      telefono: '55 1234 5678',
      correo: 'compras@ejemplo.mx',
      direccion: 'Av. Reforma 123, Col. Centro, CDMX',
      infoFiscal: { regimen: '601 - General de Ley Personas Morales', usoCfdi: 'G03 - Gastos en general', domicilioFiscalCp: '06000' },
    },
    conceptos,
    resumen: { subtotal, descuentoTotal, impuestos, total },
    piePagina: { observaciones: 'Cotización de ejemplo generada solo para vista previa de la plantilla — no corresponde a un documento real.' },
    extra: { vigencia: '30/09/2026' },
  };
}
