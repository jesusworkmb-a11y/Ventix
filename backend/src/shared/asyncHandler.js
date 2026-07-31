// Envuelve handlers async para que cualquier rechazo llegue al middleware de errores de app.js
// en vez de quedar como una promesa no manejada.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
