const AppError = require('../errors/AppError');

// Punto único de integración con el PAC (Facturama), mismo criterio que correo.service.js: acá
// vive todo lo que sabe hablar con el proveedor externo, el resto de la app solo arma/lee datos.
// Contra el sandbox de Facturama (facturas apócrifas, sin valor fiscal) mientras se prueba --
// pasar a producción es cambiar FACTURAMA_BASE_URL/USER/PASSWORD, sin tocar este archivo.
//
// Endpoints confirmados a mano contra el sandbox real (no toda la API está documentada con
// ejemplos claros): registrar CSD y timbrar/descargar-XML/cancelar usan prefijos distintos
// (api-lite para "multiemisor", que es el modo que necesita Ventix porque cada empresa puede
// tener su propio RFC/CSD).
const RUTA_CSD = '/api-lite/csds';
const RUTA_TIMBRAR = '/api-lite/3/cfdis';
const RUTA_XML = (pacId) => `/api/Cfdi/xml/issuedLite/${pacId}`;
const RUTA_CANCELAR = (pacId) => `/cfdi/${pacId}`;

function baseUrl() {
  const url = process.env.FACTURAMA_BASE_URL;
  if (!url) throw new AppError(500, 'El timbrado no está configurado en el servidor.');
  return url;
}

function headerAuth() {
  const { FACTURAMA_USER, FACTURAMA_PASSWORD } = process.env;
  if (!FACTURAMA_USER || !FACTURAMA_PASSWORD) {
    throw new AppError(500, 'El timbrado no está configurado en el servidor.');
  }
  return `Basic ${Buffer.from(`${FACTURAMA_USER}:${FACTURAMA_PASSWORD}`).toString('base64')}`;
}

// El mensaje de Facturama ya viene en español y suele ser específico y accionable ("el RFC del
// receptor debe estar en el padrón del SAT", "falta el campo Folio") -- se lo pasamos al usuario
// tal cual en vez de taparlo con un mensaje genérico, a diferencia del resto de la app (que sí
// oculta errores técnicos crudos, §33.2) porque este es justamente el mensaje pensado para
// mostrarse.
function mensajeError(cuerpo) {
  if (!cuerpo) return 'El PAC rechazó la solicitud.';
  try {
    const json = JSON.parse(cuerpo);
    if (json.ModelState) {
      const primero = Object.values(json.ModelState)[0];
      return Array.isArray(primero) ? primero[0] : json.Message;
    }
    return json.Message || json.MessageDetail || cuerpo;
  } catch {
    return cuerpo;
  }
}

async function llamar(metodo, ruta, body) {
  const res = await fetch(`${baseUrl()}${ruta}`, {
    method: metodo,
    headers: { Authorization: headerAuth(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  if (!res.ok) throw new AppError(res.status === 400 ? 400 : 502, mensajeError(texto));
  return texto ? JSON.parse(texto) : null;
}

// Si el RFC ya tiene un CSD registrado en el PAC (recarga tras vencer, o corregir un error),
// Facturama rechaza el POST -- reintenta con PUT (su endpoint de actualización) en ese caso
// específico, en vez de hacer fallar la operación.
async function registrarCsd({
  rfc, certificadoBase64, llaveBase64, contrasena,
}) {
  const datos = {
    Rfc: rfc, Certificate: certificadoBase64, PrivateKey: llaveBase64, PrivateKeyPassword: contrasena,
  };
  try {
    await llamar('POST', RUTA_CSD, datos);
  } catch (err) {
    if (!/ya existe/i.test(err.publicMessage || '')) throw err;
    await llamar('PUT', `${RUTA_CSD}/${rfc}`, datos);
  }
}

// `cfdi` ya viene armado en el shape exacto que espera Facturama (Issuer/Receiver/Items/Taxes) --
// ver facturas.pac.js para el mapeo desde el modelo interno de Ventix.
async function timbrar(cfdi) {
  const respuesta = await llamar('POST', RUTA_TIMBRAR, cfdi);
  const timbre = respuesta.Complement?.TaxStamp;
  if (!timbre) throw new AppError(502, 'El PAC no devolvió el timbre fiscal.');
  return {
    pacId: respuesta.Id,
    uuid: timbre.Uuid,
    fechaTimbrado: timbre.Date,
    selloSAT: timbre.SatSign,
    noCertificadoSAT: timbre.SatCertNumber,
    cadenaOriginal: respuesta.OriginalString,
  };
}

async function obtenerXmlBase64(pacId) {
  const respuesta = await llamar('GET', RUTA_XML(pacId));
  return respuesta.Content;
}

async function cancelar({ pacId, motivo, uuidSustituto }) {
  const query = new URLSearchParams({ type: 'issuedLite', motive: motivo });
  if (uuidSustituto) query.set('uuidReplacement', uuidSustituto);
  await llamar('DELETE', `${RUTA_CANCELAR(pacId)}?${query.toString()}`);
}

module.exports = {
  registrarCsd, timbrar, obtenerXmlBase64, cancelar,
};
