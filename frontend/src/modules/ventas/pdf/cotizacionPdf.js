import { guardarDocumento, base64Documento } from '../../../shared/pdf/motor';

// `vigencia` es una fecha de calendario pura (sin hora, ver Cotizacion.vigencia en el schema) —
// se formatea por substring en vez de con formatoFecha (que usa Intl con hora y zona horaria del
// navegador) para no mostrar un día distinto al que se capturó.
function formatoFechaCorta(fechaIso) {
  if (!fechaIso) return '';
  const [anio, mes, dia] = fechaIso.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

const TONO_ESTADO = { VIGENTE: 'exito', CONVERTIDA: 'neutro', CANCELADA: 'peligro' };
const TEXTO_ESTADO = { VIGENTE: 'Vigente', CONVERTIDA: 'Convertida', CANCELADA: 'Cancelada' };

// `impuestoTasa` viaja congelada por línea desde que se crea la cotización (ver
// cotizaciones.service.js#crear) — así el PDF siempre coincide exactamente con lo que se cotizó
// (Cotizacion.total, ya con impuesto incluido), sin importar si el catálogo cambia después.
function construirDatos(cotizacion, empresa) {
  let subtotal = 0;
  let impuestos = 0;
  let descuentoTotal = 0;
  const conceptos = cotizacion.detalles.map((d) => {
    const cantidad = Number(d.cantidad);
    const precio = Number(d.precio);
    const descuentoMonto = Number(d.descuentoMonto || 0);
    const importe = cantidad * precio - descuentoMonto;
    const tasa = Number(d.impuestoTasa || 0);
    subtotal += importe;
    impuestos += importe * tasa;
    descuentoTotal += descuentoMonto;
    return {
      codigo: d.articulo?.sku || '—',
      descripcion: d.articulo?.nombre || d.articuloId,
      cantidad,
      unidad: null,
      precioUnitario: precio,
      descuento: descuentoMonto,
      impuestoTexto: tasa > 0 ? `${Math.round(tasa * 100)}%` : '—',
      importe,
      imagenUrl: d.articulo?.imagenUrl || null,
    };
  });
  subtotal = Math.round(subtotal * 100) / 100;
  impuestos = Math.round(impuestos * 100) / 100;
  descuentoTotal = Math.round(descuentoTotal * 100) / 100;
  const total = Math.round((subtotal + impuestos) * 100) / 100;

  return {
    tipoDocumento: 'COTIZACION',
    tituloDocumento: 'COTIZACIÓN',
    folio: cotizacion.folio,
    fecha: cotizacion.creadoEn,
    estatus: cotizacion.estado
      ? { texto: TEXTO_ESTADO[cotizacion.estado] || cotizacion.estado, tono: TONO_ESTADO[cotizacion.estado] || 'neutro' }
      : null,
    // Empresa no tiene un campo de dirección propio (solo Sucursal) — se usa la de la sucursal
    // que emitió el documento, que es la dirección relevante para quien lo recibe.
    empresa: { ...empresa, direccion: cotizacion.sucursal?.direccion || null },
    contraparte: {
      etiqueta: 'Cliente',
      nombre: cotizacion.cliente?.nombre,
      rfc: cotizacion.cliente?.rfc,
      telefono: cotizacion.cliente?.telefono,
      correo: cotizacion.cliente?.correo,
      direccion: cotizacion.cliente?.direccion,
    },
    conceptos,
    resumen: { subtotal, descuentoTotal, impuestos, total },
    piePagina: { observaciones: cotizacion.observaciones },
    extra: {
      vigencia: cotizacion.vigencia ? formatoFechaCorta(cotizacion.vigencia) : null,
      sucursal: cotizacion.sucursal?.nombre,
    },
  };
}

export function generarPdfCotizacion(cotizacion, empresa) {
  const datos = construirDatos(cotizacion, empresa);
  guardarDocumento(datos, `${cotizacion.folio || 'cotizacion'}.pdf`);
}

// Para el envío por correo: el backend no genera PDFs (ver correo.service.js), así que el
// frontend arma el mismo documento y lo manda en base64 crudo (sin el prefijo `data:...;base64,`
// del data URI que devuelve jsPDF).
export function generarBase64Cotizacion(cotizacion, empresa) {
  const datos = construirDatos(cotizacion, empresa);
  return base64Documento(datos, `${cotizacion.folio || 'cotizacion'}.pdf`);
}
