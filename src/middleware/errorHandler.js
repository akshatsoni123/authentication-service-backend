const { config } = require('../config');
const { AppError } = require('../utils/AppError');

function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message =
    statusCode === 500 && config.isProd
      ? 'An unexpected error occurred'
      : err.message || 'An unexpected error occurred';

  if (!(err instanceof AppError) || statusCode >= 500) {
    console.error('[error]', err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}

module.exports = { errorHandler };
