const express = require('express');
const rateLimit = require('express-rate-limit');

// MOD-FACTURACION -- Fase C agrega facturas (Directa/Venta POS/Global/Consolidada). Fase E
// (portal público de autofacturación) agregada acá abajo, como submódulo `portalPublico`. No
// agregar endpoints de otros módulos acá (regla de límites de módulo, §3.1).
const catalogosSatRoutes = require('./catalogosSat/catalogosSat.routes');
const facturasRoutes = require('./facturas/facturas.routes');
const plantillasRoutes = require('./plantillas/plantillas.routes');
const portalPublicoRoutes = require('./portalPublico/portalPublico.routes');

const router = express.Router();

router.use('/catalogos-sat', catalogosSatRoutes);
router.use('/facturas', facturasRoutes);
router.use('/plantillas', plantillasRoutes);

// Portal público de autofacturación (Fase E) -- a diferencia de los tres de arriba, este
// submódulo NO pasa por `auth` (sin login, ver portalPublico.routes.js). Es el único punto sin
// autenticar de todo el backend además de /core/login|registro, así que lleva rate-limit propio
// (no existía ningún rate-limiter en el proyecto hasta ahora).
const limitarPortalPublico = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
});
router.use('/portal-publico', limitarPortalPublico, portalPublicoRoutes);

module.exports = router;
