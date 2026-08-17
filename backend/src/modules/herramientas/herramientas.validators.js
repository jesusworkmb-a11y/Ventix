const { z } = require('zod');

const csvSchema = z.object({
  csv: z.string().min(1),
});

// Mismo shape para los tres importadores -- cada uno con su propio nombre por claridad en el
// controller, no porque el contenido difiera.
module.exports = {
  importarArticulosSchema: csvSchema,
  importarClientesSchema: csvSchema,
  importarProveedoresSchema: csvSchema,
};
