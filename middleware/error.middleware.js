const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Server Error",
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });
};

export default errorMiddleware;