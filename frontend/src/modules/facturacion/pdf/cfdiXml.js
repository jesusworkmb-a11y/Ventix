// Extrae del XML timbrado (ya persistido en base64 en Factura.xmlTimbrado) los dos datos que
// el PAC no devuelve directo y por lo tanto no se guardan en la tabla Factura: el sello propio
// del emisor (distinto del selloSAT del PAC) y el número de serie del certificado del emisor —
// ambos viven como atributos del nodo raíz cfdi:Comprobante. Usa el DOMParser nativo del
// navegador, sin dependencia nueva. Si el XML no parsea, se devuelve un objeto vacío — la
// Factura PDF se genera igual, solo sin esos dos renglones opcionales.
export function extraerSelloYCertificadoEmisor(xmlTimbradoBase64) {
  if (!xmlTimbradoBase64) return {};
  try {
    const xmlTexto = atob(xmlTimbradoBase64);
    const xmlDoc = new DOMParser().parseFromString(xmlTexto, 'application/xml');
    if (xmlDoc.querySelector('parsererror')) return {};
    const comprobante = xmlDoc.documentElement;
    return {
      selloEmisor: comprobante.getAttribute('Sello') || null,
      noCertificadoEmisor: comprobante.getAttribute('NoCertificado') || null,
    };
  } catch (err) {
    return {};
  }
}
