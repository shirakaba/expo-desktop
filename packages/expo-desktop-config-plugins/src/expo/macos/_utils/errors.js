class UnexpectedError extends Error {
  name = "UnexpectedError";
  constructor(message) {
    super(`${message}\nPlease report this as an issue on https://github.com/expo/expo/issues`);
  }
}

class PluginError extends Error {
  name = "PluginError";
  isPluginError = true;

  constructor(message, code, cause) {
    super(cause ? `${message}\n└─ Cause: ${cause.name}: ${cause.message}` : message);
    this.code = code;
    this.cause = cause;
  }
}

exports.PluginError = PluginError;
exports.UnexpectedError = UnexpectedError;
