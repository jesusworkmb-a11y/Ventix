import { guardarDocumento, base64Documento } from '../../../shared/pdf/motor';

const TONO_ESTADO = { CONFIRMADA: 'exito', CANCELADA: 'peligro' };
const TEXTO_ESTADO = { CONFIRMADA: 'Confirmada', CANCELADA: 'Cancelada' };

// A diferencia de Cotizacion (que no tiene columnas subtotal/impuestos propias y recalcula desde
// las líneas), Compra sí las persiste directo — se usan tal cual, sin recalcular, para que el PDF
// siempre coincida exactamente con lo que se guardó (compras registradas antes de este campo
// quedaron con impuestos=0 y subtotal=total, ver el backfill de la migración).
function construirDatos(compra, empresa) {
  const conceptos = compra.detalles.map((d) => {
    const cantidad = Number(d.cantidad);
    const costo = Number(d.costo);
    const descuentoMonto = Number(d.descuentoMonto || 0);
    const tasa = Number(d.impuestoTasa || 0);
    return {
      codigo: d.articulo?.sku || '—',
      descripcion: d.articulo?.nombre || d.articuloId,
      cantidad,
      unidad: d.unidad?.abreviatura || d.unidad?.nombre || null,
      precioUnitario: costo,
      descuento: descuentoMonto,
      impuestoTexto: tasa > 0 ? `${Math.round(tasa * 100)}%` : '—',
      importe: cantidad * costo - descuentoMonto,
      imagenUrl: d.articulo?.imagenUrl || null,
    };
  });
  const descuentoTotal = Math.round(conceptos.reduce((acc, l) => acc + l.descuento, 0) * 100) / 100;
  const subtotal = Number(compra.subtotal);
  const impuestos = Number(compra.impuestos);
  const total = Number(compra.total);

  return {
    tipoDocumento: 'COMPRA',
    tituloDocumento: 'COMPRA',
    folio: compra.folio,
    fecha: compra.creadoEn,
    estatus: compra.estado
      ? { texto: TEXTO_ESTADO[compra.estado] || compra.estado, tono: TONO_ESTADO[compra.estado] || 'neutro' }
      : null,
    empresa: { ...empresa, direccion: compra.sucursal?.direccion || null },
    contraparte: {
      etiqueta: 'Proveedor',
      nombre: compra.proveedor?.nombre,
      telefono: compra.proveedor?.telefono,
      correo: compra.proveedor?.correo,
      direccion: compra.proveedor?.direccion,
    },
    conceptos,
    resumen: { subtotal, descuentoTotal, impuestos, total },
    piePagina: { observaciones: compra.observaciones },
    extra: { folioProveedor: compra.folioProveedor, sucursal: compra.sucursal?.nombre },
  };
}

export function generarPdfCompra(compra, empresa) {
  const datos = construirDatos(compra, empresa);
  guardarDocumento(datos, `${compra.folio || 'compra'}.pdf`);
}

// Para el envío por correo: el backend no genera PDFs (ver correo.service.js), así que el
// frontend arma el mismo documento y lo manda en base64 crudo (sin el prefijo `data:...;base64,`
// del data URI que devuelve jsPDF).
export function generarBase64Compra(compra, empresa) {
  const datos = construirDatos(compra, empresa);
  return base64Documento(datos, `${compra.folio || 'compra'}.pdf`);
}
