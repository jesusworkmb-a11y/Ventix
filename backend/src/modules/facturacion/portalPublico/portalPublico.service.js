const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const facturasService = require('../facturas/facturas.service');

// Sin usuario autenticado -- Factura.usuarioId es obligatorio en el schema pero "suelto" (sin
// @relation a Usuario, mismo criterio que ventaId en FacturaVenta), así que un sentinel de texto
// alcanza: no rompe ninguna FK, no se muestra en ningún listado del frontend hoy, y en Auditoría
// (que sí resuelve usuarioEjecutorId contra la lista de usuarios) cae al fallback y muestra el
// string crudo -- perfectamente legible como "quién hizo esto".
const USUARIO_PORTAL_PUBLICO = 'portal-publico';

// Mismo mensaje genérico para folio inexistente, monto que no coincide, o venta de otra empresa
// -- no distinguir el motivo evita que alguien use el monto como oráculo para ir adivinando
// folios ajenos por fuerza bruta.
const VENTA_NO_ENCONTRADA = 'No encontramos ese ticket. Revisá el folio y el monto exactos.';

async function resolverEmpresaPorSlug(slug) {
  const empresa = await prisma.empresa.findFirst({ where: { slugPublico: slug, estado: 'ACTIVA' } });
  if (!empresa) throw new AppError(404, 'Portal no disponible.');
  return empresa;
}

async function obtenerEmpresaPublica({ slug }) {
  const empresa = await resolverEmpresaPorSlug(slug);
  return { nombreComercial: empresa.nombreComercial, logoUrl: empresa.logoUrl };
}

// RFC emisor real de la venta (sucursal.rfc si lo tiene, si no el de la empresa) -- mismo
// criterio de resolución que facturas.service.js#resolverEmisor, pero sin exigir que
// razonSocial/regimenFiscal/CP también estén completos: acá solo hace falta el RFC para
// comparar contra lo que tecleó el visitante, no armar el CFDI todavía.
async function resolverRfcEmisorDeVenta(venta) {
  const [empresa, sucursal] = await Promise.all([
    prisma.empresa.findUnique({ where: { id: venta.empresaId }, select: { rfc: true } }),
    prisma.sucursal.findFirst({ where: { id: venta.sucursalId, empresaId: venta.empresaId }, select: { rfc: true } }),
  ]);
  return sucursal?.rfc || empresa?.rfc || null;
}

// El monto y el RFC emisor actúan como segundo y tercer factor livianos (folio solo no alcanza --
// son secuenciales y fáciles de adivinar; agregado a pedido del usuario en la ronda de QA
// pre-lanzamiento). Comparación de total con tolerancia de centavos en vez de exacta porque viaja
// como texto desde un <input type="number"> del navegador. El RFC no distingue el motivo del
// rechazo del resto (mismo mensaje genérico) -- si se revelara "folio+total OK pero RFC no",
// reabriría el mismo oráculo que este diseño ya evita para folio/total.
async function buscarVentaFacturable({ slug, folio, total, rfcEmisor }) {
  const empresa = await resolverEmpresaPorSlug(slug);
  const venta = await prisma.venta.findFirst({ where: { empresaId: empresa.id, folio } });
  if (!venta || Math.abs(Number(venta.total) - Number(total)) > 0.01) {
    throw new AppError(404, VENTA_NO_ENCONTRADA);
  }
  const rfcReal = await resolverRfcEmisorDeVenta(venta);
  if (!rfcReal || rfcReal.toUpperCase() !== String(rfcEmisor).toUpperCase()) {
    throw new AppError(404, VENTA_NO_ENCONTRADA);
  }
  if (venta.estado !== 'CONFIRMADA') throw new AppError(400, 'Ese ticket fue cancelado, no se puede facturar.');
  if (venta.facturaId) throw new AppError(409, 'Ese ticket ya fue facturado.');
  return venta;
}

async function buscarVenta({ slug, folio, total, rfcEmisor }) {
  const venta = await buscarVentaFacturable({ slug, folio, total, rfcEmisor });
  return { folio: venta.folio, fecha: venta.creadoEn, total: venta.total };
}

// Reusa crearDesdeVenta tal cual (facturas.service.js ya la dejó preparada para esto, ver su
// comentario in-line) -- mismo candado anti-duplicado atómico, misma validación de datos
// fiscales/claves SAT, cero lógica de facturación duplicada acá.
async function facturar({ slug, folio, total, rfcEmisor, receptor }) {
  const venta = await buscarVentaFacturable({ slug, folio, total, rfcEmisor });
  return facturasService.crearDesdeVenta({
    empresaId: venta.empresaId,
    usuarioId: USUARIO_PORTAL_PUBLICO,
    tipo: 'AUTOFACTURACION',
    ventaId: venta.id,
    receptor,
  });
}

module.exports = { obtenerEmpresaPublica, buscarVenta, facturar };
