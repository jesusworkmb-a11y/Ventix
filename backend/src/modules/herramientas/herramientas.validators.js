const { z } = require('zod');

const importarArticulosSchema = z.object({
  csv: z.string().min(1),
});

module.exports = { importarArticulosSchema };
