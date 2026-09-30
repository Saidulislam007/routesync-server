export function errorHandler(error, _req, res, _next) {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : 500;

  const isProduction = process.env.NODE_ENV === "production";
  const message =
    statusCode === 500 && isProduction
      ? "Internal server error"
      : error.message || "Something went wrong";

  const response = {
    success: false,
    message,
  };

  if (error.details) {
    response.details = error.details;
  }

  if (!isProduction && error.stack) {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
}
