import { obtenerPlantilla } from './plantillas';
import { resolverTema } from './tema';

/**
 * Forma canónica de `datos` que espera cada plantilla (ver plantillas/*.js):
 * {
 *   tipoDocumento, tituloDocumento,          // 'COTIZACIÓN' | 'COMPRA' | 'ORDEN DE COMPRA' | 'FACTURA'
 *   folio, fecha, estatus: { texto, tono },  // tono: neutro | exito | peligro | advertencia
 *   empresa,                                 // objeto Empresa tal cual (nombreComercial, logoUrl,
 *                                             // rfc, telefono, correo, sitioWeb, datosBancarios,
 *                                             // terminosCondicionesPdf, colorPrimario/Secundario/Acento,
 *                                             // plantillaPdf) — se pasa completo, cada plantilla lee
 *                                             // lo que necesita.
 *   contraparte: { etiqueta, nombre, rfc, telefono, correo, direccion, infoFiscal },
 *   conceptos: [{ codigo, descripcion, cantidad, unidad, precioUnitario,
 *                 descuento, impuestoTexto, importe, imagenUrl }],
 *   resumen: { subtotal, descuentoTotal, impuestos, total },
 *   piePagina: { observaciones },
 *   extra: {},   // campos propios del documento (vigencia, folioProveedor, qrDataUrl, etc.)
 * }
 *
 * Construida por cada xPdf.js (cotizacionPdf.js, compraPdf.js, ordenCompraPdf.js, facturaPdf.js)
 * a partir de su entidad real, conservando el cálculo de totales/normalización que ya existía.
 */

function construirDocumento(datos) {
  const plantilla = obtenerPlantilla(datos.empresa?.plantillaPdf);
  const tema = resolverTema(datos.empresa, plantilla.coloresPorDefecto);
  return plantilla.render(datos, tema);
}

export function guardarDocumento(datos, nombreArchivo) {
  const doc = construirDocumento(datos);
  doc.save(nombreArchivo);
}

export function base64Documento(datos, nombreArchivo) {
  const doc = construirDocumento(datos);
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',')[1];
  return { base64, nombreArchivo };
}

// Para la "Vista previa" en EmpresaPage: arma el doc y devuelve una blob URL para abrir en una
// pestaña nueva, sin descargar ni guardar nada.
export function urlVistaPrevia(datos) {
  const doc = construirDocumento(datos);
  return doc.output('bloburl');
}
