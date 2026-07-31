// Error de negocio con mensaje seguro para el usuario. app.js lo traduce a
// { error: publicMessage } con el status dado (§33.2, no exponer errores técnicos crudos).
class AppError extends Error {
  constructor(status, publicMessage) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

module.exports = AppError;
