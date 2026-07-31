require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Ventix backend escuchando en puerto ${PORT}`); // eslint-disable-line no-console
});
