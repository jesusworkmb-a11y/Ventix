require('dotenv').config();
const app = require('./app');
const seedPermisos = require('./shared/bootstrap/seedPermisos');

const PORT = process.env.PORT || 4000;

seedPermisos()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Ventix backend escuchando en puerto ${PORT}`); // eslint-disable-line no-console
    });
  })
  .catch((error) => {
    console.error('No se pudo inicializar el catálogo de permisos:', error); // eslint-disable-line no-console
    process.exit(1);
  });
