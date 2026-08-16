// Consumo atómico de folios (§9): SIEMPRE debe llamarse con el tx de la misma transacción
// que crea el documento, para que folio y documento se confirmen o fallen juntos (sin huecos).
async function obtenerSiguienteFolio(tx, { empresaId, sucursalId = null, tipoDocumento }) {
  // Prisma no acepta `null` dentro de un where compuesto único (empresaId_sucursalId_tipoDocumento),
  // aunque la columna sí lo permita — para secuencias a nivel empresa (sucursalId: null, ej. TRA)
  // hay que ubicar la fila con un where normal y actualizar por id.
  if (sucursalId === null) {
    const actual = await tx.secuencia.findFirst({ where: { empresaId, sucursalId: null, tipoDocumento } });
    if (!actual) throw new Error(`No existe secuencia ${tipoDocumento} a nivel empresa para ${empresaId}.`);
    const secuencia = await tx.secuencia.update({
      where: { id: actual.id },
      data: { siguienteNumero: { increment: 1 } },
    });
    return `${secuencia.prefijo}${String(secuencia.siguienteNumero - 1).padStart(6, '0')}`;
  }

  const secuencia = await tx.secuencia.update({
    where: { empresaId_sucursalId_tipoDocumento: { empresaId, sucursalId, tipoDocumento } },
    data: { siguienteNumero: { increment: 1 } },
  });
  return `${secuencia.prefijo}${String(secuencia.siguienteNumero - 1).padStart(6, '0')}`;
}

// Filas de Secuencia VTA/COM/COT/DEV/AJU que necesita cualquier sucursal para poder generar
// folios — las usa tanto el alta de empresa (para la sucursal Matriz) como el alta de una
// sucursal nueva (sucursales.service.js#crear). Antes solo se sembraban al dar de alta la
// empresa: una sucursal creada después se quedaba sin estas filas y el primer documento
// (venta/compra/cotización/devolución/ajuste) ahí reventaba con 500 en obtenerSiguienteFolio
// (el UPDATE no encuentra fila -> excepción sin capturar). Verificado en vivo al crear una
// venta de prueba en una sucursal nueva.
function buildSecuenciasPorSucursal(empresaId, sucursal) {
  return ['VTA', 'COM', 'COT', 'DEV', 'AJU', 'FAC', 'OC'].map((tipoDocumento) => ({
    empresaId,
    sucursalId: sucursal.id,
    tipoDocumento,
    prefijo: `${tipoDocumento}-${sucursal.clave}-`,
    siguienteNumero: 1,
  }));
}

// Filas iniciales de Secuencia creadas al dar de alta una empresa. TRA queda a nivel empresa
// (una transferencia no pertenece a una sola sucursal) y se siembra una única vez aquí —
// sucursales.service.js#crear NO debe volver a llamar esto para sucursales nuevas, o
// duplicaría la fila TRA de la empresa (usa buildSecuenciasPorSucursal en su lugar).
function buildSecuenciasIniciales(empresaId, sucursal) {
  const porEmpresa = [
    {
      empresaId,
      sucursalId: null,
      tipoDocumento: 'TRA',
      prefijo: 'TRA-',
      siguienteNumero: 1,
    },
  ];

  return [...buildSecuenciasPorSucursal(empresaId, sucursal), ...porEmpresa];
}

module.exports = { obtenerSiguienteFolio, buildSecuenciasIniciales, buildSecuenciasPorSucursal };
