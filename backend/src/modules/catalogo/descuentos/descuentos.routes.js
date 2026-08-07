const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./descuentos.controller');

const router = express.Router();
router.use(auth);

// El GET va con catalogo.articulos.ver (no con catalogo.descuentos.gestionar): un Cajero sin
// permiso para gestionar el catálogo de todos modos necesita listar los descuentos activos
// para poder aplicarlos en una venta (ver venta.aplicar_descuento en VentasPage).
router.get('/', requierePermiso('catalogo.articulos.ver'), asyncHandler(controller.listar));
router.post('/', requierePermiso('catalogo.descuentos.gestionar'), asyncHandler(controller.crear));
router.patch('/:id', requierePermiso('catalogo.descuentos.gestionar'), asyncHandler(controller.actualizar));
router.delete('/:id', requierePermiso('catalogo.descuentos.gestionar'), asyncHandler(controller.eliminar));

module.exports = router;
