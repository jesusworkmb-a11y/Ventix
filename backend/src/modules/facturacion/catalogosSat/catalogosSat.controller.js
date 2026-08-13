const AppError = require('../../../shared/errors/AppError');
const service = require('./catalogosSat.service');

// Mismos "tipo" que catalogosSat.data.js (CATALOGOS_SAT_CHICOS) + los dos catálogos grandes
// (ClaveProdServ/ClaveUnidad) que todavía no se siembran pero ya tienen su lugar en el schema.
const TIPOS_VALIDOS = [
  'RegimenFiscal',
  'UsoCfdi',
  'FormaPago',
  'MetodoPago',
  'Moneda',
  'Pais',
  'TipoFactor',
  'ObjetoImp',
  'Impuesto',
  'MotivoCancelacion',
  'Periodicidad',
  'Meses',
  'ClaveProdServ',
  'ClaveUnidad',
];

async function buscar(req, res) {
  const { tipo, q, limite } = req.query;
  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    throw new AppError(400, 'Tipo de catálogo SAT inválido.');
  }
  const resultados = await service.buscar({ tipo, q, limite });
  res.json(resultados);
}

module.exports = { buscar };
