const express = require('express');

// MOD-002 Catalogo -- Fase 2: articulos, servicios, categorias, unidades, impuestos, listas de precio
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const categoriasRoutes = require('./categorias/categorias.routes');
const marcasRoutes = require('./marcas/marcas.routes');
const unidadesRoutes = require('./unidades/unidades.routes');
const impuestosRoutes = require('./impuestos/impuestos.routes');
const articulosRoutes = require('./articulos/articulos.routes');
const listasPrecioRoutes = require('./listasPrecio/listasPrecio.routes');

const router = express.Router();

router.use('/categorias', categoriasRoutes);
router.use('/marcas', marcasRoutes);
router.use('/unidades', unidadesRoutes);
router.use('/impuestos', impuestosRoutes);
router.use('/articulos', articulosRoutes);
router.use('/listas-precio', listasPrecioRoutes);

module.exports = router;
