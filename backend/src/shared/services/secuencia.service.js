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

// Filas iniciales de Secuencia creadas al dar de alta una empresa. VTA/COM/COT/DEV/AJU quedan
// a nivel de la sucursal Matriz; TRA queda a nivel empresa (una transferencia no pertenece a
// una sola sucursal). No existe endpoint público que cree Secuencia, así que la ausencia de
// unicidad real de Postgres entre múltiples filas con sucursalId=NULL no es un riesgo aquí.
function buildSecuenciasIniciales(empresaId, sucursal) {
  const porSucursal = ['VTA', 'COM', 'COT', 'DEV', 'AJU'].map((tipoDocumento) => ({
    empresaId,
    sucursalId: sucursal.id,
    tipoDocumento,
    prefijo: `${tipoDocumento}-${sucursal.clave}-`,
    siguienteNumero: 1,
  }));

  const porEmpresa = [
    {
      empresaId,
      sucursalId: null,
      tipoDocumento: 'TRA',
      prefijo: 'TRA-',
      siguienteNumero: 1,
    },
  ];

  return [...porSucursal, ...porEmpresa];
}

module.exports = { obtenerSiguienteFolio, buildSecuenciasIniciales };
