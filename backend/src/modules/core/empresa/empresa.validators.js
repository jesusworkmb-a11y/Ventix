const { z } = require('zod');

// logoUrl viaja como data URI (base64) generada en el navegador — no hay almacenamiento de
// archivos en este backend (mismo criterio que Articulo.imagenUrl, que tampoco lo tiene). El
// frontend ya redimensiona/comprime la imagen antes de mandarla; este máximo es solo un
// resguardo con mensaje claro antes de que lo corte el límite de body de express (ver app.js).
const actualizarEmpresaSchema = z.object({
  nombreComercial: z.string().min(1, 'El nombre comercial es obligatorio.'),
  logoUrl: z.string().max(2_000_000, 'El logo es demasiado grande.').nullable().optional(),
});

module.exports = { actualizarEmpresaSchema };
