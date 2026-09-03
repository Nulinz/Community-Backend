/**
 * Centralized API error handling middleware.
 * Intercepts all operational and uncaught server errors, logs detailed diagnostics
 * internally for debugging, and returns clean, sanitized, user-safe JSON responses.
 * Prevents stack traces, server.js / router paths, and internal database details
 * from leaking to client applications.
 */
const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let userMessage = "An unexpected error occurred. Please try again later.";

  // 1. Internal diagnostic logging (visible only on server console/logs)
  const timestamp = new Date().toISOString();
  console.error(`\n[API ERROR ${timestamp}] ${req.method} ${req.originalUrl}`);
  console.error(`Client IP: ${req.ip || req.connection?.remoteAddress}`);
  console.error(`Status: ${statusCode} | Internal Message: ${err.message}`);
  if (err.stack) {
    console.error(`Internal Stack Trace:\n${err.stack}\n`);
  }

  // 2. Map known third-party / database operational exceptions
  if (err.name === "CastError") {
    // Malformed MongoDB ObjectId
    statusCode = 404;
    userMessage = "The requested resource could not be found.";
  } else if (err.code === 11000) {
    // MongoDB duplicate key collision
    statusCode = 409;
    const duplicateKey = Object.keys(err.keyValue || {})[0];
    userMessage = duplicateKey
      ? `A record with this ${duplicateKey} already exists.`
      : "A duplicate record already exists.";
  } else if (err.name === "ValidationError") {
    // Mongoose schema validation failure
    statusCode = 400;
    userMessage = Object.values(err.errors || {})
      .map((item) => item.message)
      .join(", ") || "Validation failed.";
  } else if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    // JWT authentication failure
    statusCode = 401;
    userMessage = "Your session has expired or is invalid. Please sign in again.";
  } else if (err.isOperational) {
    // Trusted operational error with an explicitly supplied user message
    userMessage = err.message || userMessage;
  } else if (statusCode >= 400 && statusCode < 500) {
    // Standard 4xx client errors
    userMessage = err.message || "Invalid request.";
  }

  // 3. Security Sanitization: Redact any accidental filesystem paths, filenames, or technical keywords
  userMessage = String(userMessage)
    // Redact "Route not found" or "Error: Route not found" patterns
    .replace(/(?:Error:\s*)?Route not found(?:\s*:\s*[^\n\r]*)?/gi, "The requested resource could not be found.")
    // Redact Windows absolute file paths (e.g. C:\... or e:\...)
    .replace(/[A-Za-z]:\\[^ \n\r\t,"]+/g, "")
    // Redact file:/// URIs
    .replace(/file:\/\/\/[^ \n\r\t,"]+/g, "")
    // Redact POSIX file paths ending with code extensions
    .replace(/(?:\/[a-zA-Z0-9_.-]+)+\.(?:js|mjs|cjs|ts|jsx|tsx|json)/g, "")
    // Redact router / server filename traces
    .replace(/(?:server|router(?:\/index)?)\.js/gi, "")
    // Clean up duplicate spaces left by redactions
    .replace(/\s+/g, " ")
    .trim();

  if (!userMessage) {
    userMessage = "An unexpected error occurred. Please try again later.";
  }

  // 4. Return clean, unified, client-safe response (stack trace is NEVER exposed)
  return res.status(statusCode).json({
    success: false,
    message: userMessage,
    statusCode,
  });
};

export default errorMiddleware;