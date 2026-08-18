const { z } = require('zod');

const cambiarEstadoSchema = z.object({
  estado: z.enum(['ACTIVA', 'SUSPENDIDA', 'ARCHIVADA']),
});

module.exports = { cambiarEstadoSchema };
