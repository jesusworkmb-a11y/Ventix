const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const requierePermiso = require('../../../middlewares/permisos.middleware');
const controller = require('./articulos.controller');

const router = express.Router();
router.use(auth);

router.get('/', requierePermiso('catalogo.articulos.ver'), asyncHandler(controller.listar));
router.get('/:id', requierePermiso('catalogo.articulos.ver'), asyncHandler(controller.obtener));
router.post('/', requierePermiso('catalogo.articulos.gestionar'), asyncHandler(controller.crear));
router.patch('/:id', requierePermiso('catalogo.articulos.gestionar'), asyncHandler(controller.actualizar));
router.put(
  '/:id/unidades-alternas',
  requierePermiso('catalogo.articulos.gestionar'),
  asyncHandler(controller.actualizarUnidadesAlternas),
);
router.put('/:id/precios', requierePermiso('catalogo.precios.gestionar'), asyncHandler(controller.actualizarPrecios));
router.put(
  '/:id/variantes',
  requierePermiso('catalogo.articulos.gestionar'),
  asyncHandler(controller.actualizarVariantes),
);
router.put('/:id/kit', requierePermiso('catalogo.articulos.gestionar'), asyncHandler(controller.actualizarKit));

module.exports = router;
