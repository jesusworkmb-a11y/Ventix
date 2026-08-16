require('dotenv').config();
const app = require('./app');
const seedPermisos = require('./shared/bootstrap/seedPermisos');
const seedCatalogosSat = require('./shared/bootstrap/seedCatalogosSat');
const seedSecuenciasFacturacion = require('./shared/bootstrap/seedSecuenciasFacturacion');
const seedSecuenciasOrdenesCompra = require('./shared/bootstrap/seedSecuenciasOrdenesCompra');
const backfillRolesBase = require('./shared/bootstrap/backfillRolesBase');

const PORT = process.env.PORT || 4000;

seedPermisos()
  .then(seedCatalogosSat)
  .then(seedSecuenciasFacturacion)
  .then(seedSecuenciasOrdenesCompra)
  .then(backfillRolesBase)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`BOX POS backend escuchando en puerto ${PORT}`); // eslint-disable-line no-console
    });
  })
  .catch((error) => {
    console.error('No se pudo inicializar el catálogo de permisos:', error); // eslint-disable-line no-console
    process.exit(1);
  });
