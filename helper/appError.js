/**
 * Custom application error class representing operational failures.
 * Distinguishes predictable client-facing errors (validation, 404s, unauthorized access)
 * from unexpected programming bugs or database crashes so responses can be sanitized.
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
