import QRCode from 'qrcode';
import { guardarDocumento, base64Documento } from '../../../shared/pdf/motor';
import { formatoFecha } from '../../../shared/format';
import { extraerSelloYCertificadoEmisor } from './cfdiXml';

const TONO_ESTADO = {
  BORRADOR: 'neutro', PENDIENTE: 'advertencia', TIMBRADA: 'exito', CANCELADA: 'peligro', ERROR: 'peligro',
};
const TEXTO_ESTADO = {
  BORRADOR: 'Borrador', PENDIENTE: 'Pendiente', TIMBRADA: 'Timbrada', CANCELADA: 'Cancelada', ERROR: 'Error',
};

// URL oficial de verificación de CFDI del SAT — mismos 5 parámetros que trae el QR de
// cualquier factura timbrada por un PAC (id=UUID, re=RFC emisor, rr=RFC receptor, tt=total,
// fe=últimos 8 caracteres del sello digital del SAT).
function urlVerificacionSat(factura) {
  const params = new URLSearchParams({
    id: factura.uuid || '',
    re: factura.rfcEmisor || '',
    rr: factura.rfcReceptor || '',
    tt: Number(factura.total || 0).toFixed(6),
    fe: (factura.selloSAT || '').slice(-8),
  });
  return `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?${params.toString()}`;
}

function resumirImpuestosLinea(impuestos) {
  const traslado = (impuestos || []).find((i) => i.tipo === 'TRASLADO');
  if (!traslado) return '—';
  if (traslado.tipoFactorSat === 'Exento') return 'Exento';
  return traslado.tasaOCuota ? `${(Number(traslado.tasaOCuota) * 100).toFixed(0)}%` : '—';
}

// Construye el objeto de datos canónico a partir de la Factura ya timbrada. A diferencia de
// Cotización/Compra, el emisor/receptor NO se leen de Empresa/Cliente en vivo: se usan los
// campos congelados en la propia Factura al momento de facturar (mismo criterio legal que ya
// usa el resto del módulo — ver Factura.rfcEmisor/nombreReceptor/etc. en el schema), porque son
// los que realmente se timbraron ante el SAT. `empresa` (de AuthContext) solo aporta el logo:
// un elemento visual, no un dato fiscal.
async function construirDatos(factura, empresa) {
  const conceptos = (factura.detalles || []).map((d) => ({
    codigo: d.claveProdServSat,
    descripcion: d.descripcion,
    cantidad: Number(d.cantidad),
    unidad: d.claveUnidadSat,
    precioUnitario: Number(d.valorUnitario),
    descuento: Number(d.descuento || 0),
    impuestoTexto: resumirImpuestosLinea(d.impuestos),
    importe: Number(d.importe),
    imagenUrl: null,
  }));

  const { selloEmisor, noCertificadoEmisor } = extraerSelloYCertificadoEmisor(factura.xmlTimbrado);

  let qrDataUrl = null;
  if (factura.uuid) {
    try {
      qrDataUrl = await QRCode.toDataURL(urlVerificacionSat(factura), { margin: 0, width: 240 });
    } catch (err) {
      qrDataUrl = null;
    }
  }

  return {
    tipoDocumento: 'FACTURA',
    tituloDocumento: 'FACTURA',
    folio: factura.folio,
    fecha: factura.fechaTimbrado || factura.creadoEn,
    estatus: { texto: TEXTO_ESTADO[factura.estado] || factura.estado, tono: TONO_ESTADO[factura.estado] || 'neutro' },
    empresa: { ...empresa, nombreComercial: factura.razonSocialEmisor || empresa?.nombreComercial, rfc: factura.rfcEmisor, direccion: null },
    contraparte: {
      etiqueta: 'Receptor',
      nombre: factura.nombreReceptor,
      rfc: factura.rfcReceptor,
      infoFiscal: {
        regimen: factura.regimenFiscalReceptor,
        usoCfdi: factura.usoCfdi,
        domicilioFiscalCp: factura.domicilioFiscalReceptorCp,
      },
    },
    conceptos,
    resumen: {
      subtotal: Number(factura.subtotal),
      descuentoTotal: Number(factura.totalDescuento || 0),
      impuestos: Number(factura.totalImpuestosTrasladados || 0),
      total: Number(factura.total),
    },
    piePagina: {
      observaciones: `Forma de pago (SAT): ${factura.formaPago}   ·   Método de pago: ${factura.metodoPago}   ·   Moneda: ${factura.moneda}`,
    },
    extra: {
      qrDataUrl,
      leyendaQr: 'Escanea para verificar este CFDI en el portal del SAT.',
      datosFiscalesCfdi: {
        uuid: factura.uuid,
        fechaTimbrado: factura.fechaTimbrado ? formatoFecha(factura.fechaTimbrado) : null,
        lugarExpedicion: factura.lugarExpedicion,
        noCertificadoSAT: factura.noCertificadoSAT,
        noCertificadoEmisor,
        selloSAT: factura.selloSAT,
        selloEmisor,
        cadenaOriginal: factura.cadenaOriginal,
      },
    },
  };
}

export async function generarPdfFactura(factura, empresa) {
  const datos = await construirDatos(factura, empresa);
  guardarDocumento(datos, `${factura.folio || 'factura'}.pdf`);
}

export async function generarBase64Factura(factura, empresa) {
  const datos = await construirDatos(factura, empresa);
  return base64Documento(datos, `${factura.folio || 'factura'}.pdf`);
}
