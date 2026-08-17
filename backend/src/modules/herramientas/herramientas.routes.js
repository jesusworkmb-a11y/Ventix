const express = require('express');

// MOD-010 Herramientas (Importacion/Exportacion) -- Fase 10
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const asyncHandler = require('../../shared/asyncHandler');
const auth = require('../../middlewares/auth.middleware');
const requierePermiso = require('../../middlewares/permisos.middleware');
const controller = require('./herramientas.controller');

const router = express.Router();
router.use(auth);

router.get('/articulos/exportar', requierePermiso('herramientas.exportar'), asyncHandler(controller.exportarArticulos));
router.post('/articulos/importar', requierePermiso('herramientas.importar'), asyncHandler(controller.importarArticulos));
router.get('/clientes/exportar', requierePermiso('herramientas.exportar'), asyncHandler(controller.exportarClientes));
router.post('/clientes/importar', requierePermiso('herramientas.importar'), asyncHandler(controller.importarClientes));
router.get('/proveedores/exportar', requierePermiso('herramientas.exportar'), asyncHandler(controller.exportarProveedores));
router.post('/proveedores/importar', requierePermiso('herramientas.importar'), asyncHandler(controller.importarProveedores));

module.exports = router;
