const prisma = require('../../config/db');
const { buildSecuenciasPorSucursal } = require('../services/secuencia.service');

// Autorreparación al arrancar el server, mismo criterio que seedSecuenciasFacturacion.js: 'OC'
// se agregó a buildSecuenciasPorSucursal después de que ya existieran sucursales en producción,
// así que esas quedarían sin fila OC hasta que alguien las editara. Corre en cada arranque,
// createMany + skipDuplicates -> no-op para las sucursales que ya la tienen.
async function seedSecuenciasOrdenesCompra() {
  const sucursales = await prisma.sucursal.findMany({ select: { id: true, empresaId: true, clave: true } });
  const filas = sucursales.flatMap((s) => buildSecuenciasPorSucursal(s.empresaId, s).filter((f) => f.tipoDocumento === 'OC'));
  if (filas.length === 0) return;
  await prisma.secuencia.createMany({ data: filas, skipDuplicates: true });
}

module.exports = seedSecuenciasOrdenesCompra;
