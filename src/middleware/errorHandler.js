const { config } = require('../config');
const { logger } = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message =
    statusCode === 500 && config.isProd
      ? 'An unexpected error occurred'
      : err.message || 'An unexpected error occurred';

  const logPayload = {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    statusCode,
    code,
    err: {
      message: err.message,
      stack: config.isProd ? undefined : err.stack,
    },
  };

  if (statusCode >= 500) {
    logger.error(logPayload, 'request failed');
  } else {
    logger.warn(logPayload, 'request rejected');
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(err.details ? { details: err.details } : {}),
      ...(req.id ? { requestId: req.id } : {}),
    },
  });
}

module.exports = { errorHandler };
