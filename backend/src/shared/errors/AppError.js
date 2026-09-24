// Error de negocio con mensaje seguro para el usuario. app.js lo traduce a
// { error: publicMessage } con el status dado (§33.2, no exponer errores técnicos crudos).
// `codigo` (opcional) viaja también en la respuesta cuando el frontend necesita reaccionar a un
// caso específico sin depender del texto del mensaje (ej. VIGENCIA_VENCIDA → pantalla de pago).
class AppError extends Error {
  constructor(status, publicMessage, codigo) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
    this.codigo = codigo;
  }
}

module.exports = AppError;
