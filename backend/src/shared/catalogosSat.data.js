// Catálogos oficiales del SAT usados por Facturación (CFDI 4.0). Mismo criterio que
// permisos.catalog.js: datos versionados en el repo, se resiembran cuando el SAT
// actualiza un catálogo (createMany + skipDuplicates en el bootstrap, insert-only).
//
// ClaveProdServ (~52,000 claves) y ClaveUnidad (~2,500 claves) NO van acá — son
// demasiado grandes para mantener a mano; se cargan aparte desde los archivos
// oficiales que publica el SAT (pendiente, ver seedCatalogosSat.js).
//
// Los catálogos chicos de acá cubren los valores de uso común, no el 100% de cada
// catálogo oficial (ej. Pais/Moneda tienen ~250/~170 entradas en el catálogo real);
// se puede ampliar agregando filas sin tocar el schema.

const REGIMEN_FISCAL = [
  { clave: '601', descripcion: 'General de Ley Personas Morales' },
  { clave: '603', descripcion: 'Personas Morales con Fines no Lucrativos' },
  { clave: '605', descripcion: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { clave: '606', descripcion: 'Arrendamiento' },
  { clave: '607', descripcion: 'Régimen de Enajenación o Adquisición de Bienes' },
  { clave: '608', descripcion: 'Demás ingresos' },
  { clave: '610', descripcion: 'Residentes en el Extranjero sin Establecimiento Permanente en México' },
  { clave: '611', descripcion: 'Ingresos por Dividendos (socios y accionistas)' },
  { clave: '612', descripcion: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { clave: '614', descripcion: 'Ingresos por intereses' },
  { clave: '615', descripcion: 'Régimen de los ingresos por obtención de premios' },
  { clave: '616', descripcion: 'Sin obligaciones fiscales' },
  { clave: '620', descripcion: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos' },
  { clave: '621', descripcion: 'Incorporación Fiscal' },
  { clave: '622', descripcion: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { clave: '623', descripcion: 'Opcional para Grupos de Sociedades' },
  { clave: '624', descripcion: 'Coordinados' },
  {
    clave: '625',
    descripcion: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
  },
  { clave: '626', descripcion: 'Régimen Simplificado de Confianza' },
];

const USO_CFDI = [
  { clave: 'G01', descripcion: 'Adquisición de mercancías' },
  { clave: 'G02', descripcion: 'Devoluciones, descuentos o bonificaciones' },
  { clave: 'G03', descripcion: 'Gastos en general' },
  { clave: 'I01', descripcion: 'Construcciones' },
  { clave: 'I02', descripcion: 'Mobiliario y equipo de oficina por inversiones' },
  { clave: 'I03', descripcion: 'Equipo de transporte' },
  { clave: 'I04', descripcion: 'Equipo de computo y accesorios' },
  { clave: 'I05', descripcion: 'Dados, troqueles, moldes, matrices y otros activos' },
  { clave: 'I06', descripcion: 'Comunicaciones telefónicas' },
  { clave: 'I07', descripcion: 'Comunicaciones satelitales' },
  { clave: 'I08', descripcion: 'Otra maquinaria y equipo' },
  { clave: 'D01', descripcion: 'Honorarios médicos, dentales y gastos hospitalarios' },
  { clave: 'D02', descripcion: 'Gastos médicos por incapacidad o discapacidad' },
  { clave: 'D03', descripcion: 'Gastos funerales' },
  { clave: 'D04', descripcion: 'Donativos' },
  { clave: 'D05', descripcion: 'Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)' },
  { clave: 'D06', descripcion: 'Aportaciones voluntarias al SAR' },
  { clave: 'D07', descripcion: 'Primas por seguros de gastos médicos' },
  { clave: 'D08', descripcion: 'Gastos de transportación escolar obligatoria' },
  { clave: 'D09', descripcion: 'Depósitos en cuentas para el ahorro, pensiones' },
  { clave: 'D10', descripcion: 'Pagos por servicios educativos (colegiaturas)' },
  { clave: 'S01', descripcion: 'Sin efectos fiscales' },
  { clave: 'CP01', descripcion: 'Pagos' },
  { clave: 'CN01', descripcion: 'Nómina' },
];

const FORMA_PAGO = [
  { clave: '01', descripcion: 'Efectivo' },
  { clave: '02', descripcion: 'Cheque nominativo' },
  { clave: '03', descripcion: 'Transferencia electrónica de fondos' },
  { clave: '04', descripcion: 'Tarjeta de crédito' },
  { clave: '05', descripcion: 'Monedero electrónico' },
  { clave: '06', descripcion: 'Dinero electrónico' },
  { clave: '08', descripcion: 'Vales de despensa' },
  { clave: '12', descripcion: 'Dación en pago' },
  { clave: '13', descripcion: 'Pago por subrogación' },
  { clave: '14', descripcion: 'Pago por consignación' },
  { clave: '15', descripcion: 'Condonación' },
  { clave: '17', descripcion: 'Compensación' },
  { clave: '23', descripcion: 'Novación' },
  { clave: '24', descripcion: 'Confusión' },
  { clave: '25', descripcion: 'Remisión de deuda' },
  { clave: '26', descripcion: 'Prescripción o caducidad' },
  { clave: '27', descripcion: 'A satisfacción del acreedor' },
  { clave: '28', descripcion: 'Tarjeta de débito' },
  { clave: '29', descripcion: 'Tarjeta de servicios' },
  { clave: '30', descripcion: 'Aplicación de anticipos' },
  { clave: '31', descripcion: 'Intermediario pagos' },
  { clave: '99', descripcion: 'Por definir' },
];

const METODO_PAGO = [
  { clave: 'PUE', descripcion: 'Pago en una sola exhibición' },
  { clave: 'PPD', descripcion: 'Pago en parcialidades o diferido' },
];

const MONEDA = [
  { clave: 'MXN', descripcion: 'Peso Mexicano' },
  { clave: 'USD', descripcion: 'Dólar Americano' },
  { clave: 'EUR', descripcion: 'Euro' },
  { clave: 'CAD', descripcion: 'Dólar Canadiense' },
  { clave: 'GBP', descripcion: 'Libra Esterlina' },
];

const PAIS = [
  { clave: 'MEX', descripcion: 'México' },
  { clave: 'USA', descripcion: 'Estados Unidos de América' },
  { clave: 'CAN', descripcion: 'Canadá' },
  { clave: 'ESP', descripcion: 'España' },
  { clave: 'DEU', descripcion: 'Alemania' },
  { clave: 'FRA', descripcion: 'Francia' },
  { clave: 'GTM', descripcion: 'Guatemala' },
  { clave: 'BLZ', descripcion: 'Belice' },
  { clave: 'CHN', descripcion: 'China' },
  { clave: 'JPN', descripcion: 'Japón' },
  { clave: 'ZZZ', descripcion: 'Países no especificados económicamente ni geográficamente' },
];

const TIPO_FACTOR = [
  { clave: 'Tasa', descripcion: 'Tasa' },
  { clave: 'Cuota', descripcion: 'Cuota' },
  { clave: 'Exento', descripcion: 'Exento' },
];

const OBJETO_IMP = [
  { clave: '01', descripcion: 'No objeto de impuesto' },
  { clave: '02', descripcion: 'Sí objeto de impuesto' },
  { clave: '03', descripcion: 'Sí objeto del impuesto y no obligado al desglose' },
  { clave: '04', descripcion: 'Sí objeto del impuesto y no causa impuesto' },
];

const IMPUESTO = [
  { clave: '001', descripcion: 'ISR' },
  { clave: '002', descripcion: 'IVA' },
  { clave: '003', descripcion: 'IEPS' },
];

const MOTIVO_CANCELACION = [
  { clave: '01', descripcion: 'Comprobante emitido con errores con relación' },
  { clave: '02', descripcion: 'Comprobante emitido con errores sin relación' },
  { clave: '03', descripcion: 'No se llevó a cabo la operación' },
  { clave: '04', descripcion: 'Operación nominativa relacionada en una factura global' },
];

const PERIODICIDAD = [
  { clave: '01', descripcion: 'Diario' },
  { clave: '02', descripcion: 'Semanal' },
  { clave: '03', descripcion: 'Quincenal' },
  { clave: '04', descripcion: 'Mensual' },
  { clave: '05', descripcion: 'Bimestral' },
];

const MESES = [
  { clave: '01', descripcion: 'Enero' },
  { clave: '02', descripcion: 'Febrero' },
  { clave: '03', descripcion: 'Marzo' },
  { clave: '04', descripcion: 'Abril' },
  { clave: '05', descripcion: 'Mayo' },
  { clave: '06', descripcion: 'Junio' },
  { clave: '07', descripcion: 'Julio' },
  { clave: '08', descripcion: 'Agosto' },
  { clave: '09', descripcion: 'Septiembre' },
  { clave: '10', descripcion: 'Octubre' },
  { clave: '11', descripcion: 'Noviembre' },
  { clave: '12', descripcion: 'Diciembre' },
  { clave: '13', descripcion: 'Enero-Febrero' },
  { clave: '14', descripcion: 'Marzo-Abril' },
  { clave: '15', descripcion: 'Mayo-Junio' },
  { clave: '16', descripcion: 'Julio-Agosto' },
  { clave: '17', descripcion: 'Septiembre-Octubre' },
  { clave: '18', descripcion: 'Noviembre-Diciembre' },
];

// { tipo (== nombre del modelo CatalogoSat) -> filas }. seedCatalogosSat.js itera esto.
const CATALOGOS_SAT_CHICOS = {
  RegimenFiscal: REGIMEN_FISCAL,
  UsoCfdi: USO_CFDI,
  FormaPago: FORMA_PAGO,
  MetodoPago: METODO_PAGO,
  Moneda: MONEDA,
  Pais: PAIS,
  TipoFactor: TIPO_FACTOR,
  ObjetoImp: OBJETO_IMP,
  Impuesto: IMPUESTO,
  MotivoCancelacion: MOTIVO_CANCELACION,
  Periodicidad: PERIODICIDAD,
  Meses: MESES,
};

module.exports = { CATALOGOS_SAT_CHICOS };
