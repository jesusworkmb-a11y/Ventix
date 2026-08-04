const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/health');

// Rutas de cada módulo de dominio. Se registran aquí para mantener a app.js
// como el único punto que conoce a todos los módulos — los módulos entre sí
// no se importan directamente (§3.1, §3.8).
const coreRoutes = require('./modules/core/core.routes');
const catalogoRoutes = require('./modules/catalogo/catalogo.routes');
const clientesRoutes = require('./modules/clientes/clientes.routes');
const proveedoresRoutes = require('./modules/proveedores/proveedores.routes');
const inventarioRoutes = require('./modules/inventario/inventario.routes');
const comprasRoutes = require('./modules/compras/compras.routes');
const cajaRoutes = require('./modules/caja/caja.routes');
const ventasRoutes = require('./modules/ventas/ventas.routes');
const reportesRoutes = require('./modules/reportes/reportes.routes');
const herramientasRoutes = require('./modules/herramientas/herramientas.routes');
const busquedaRoutes = require('./modules/busqueda/busqueda.routes');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
// Límite subido de 100kb (default de express) a 3mb: el logo de la empresa viaja como data URI
// (base64) en el body de PATCH /core/empresa — ver empresa.validators.js.
app.use(express.json({ limit: '3mb' }));

app.use('/api', healthRoutes);
app.use('/api/core', coreRoutes);
app.use('/api/catalogo', catalogoRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/herramientas', herramientasRoutes);
app.use('/api/busqueda', busquedaRoutes);

// Manejador de errores centralizado — traduce errores técnicos a mensajes
// en lenguaje del usuario antes de responder (§33.2, "no mostrar errores técnicos crudos").
app.use((err, req, res, next) => {
  console.error(err); // eslint-disable-line no-console
  res.status(err.status || 500).json({
    error: err.publicMessage || 'Ocurrió un problema al procesar tu solicitud. Intenta de nuevo.',
  });
});

module.exports = app;
