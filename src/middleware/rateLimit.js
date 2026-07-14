const { incr, keys } = require('../redis');
const { AppError } = require('../utils/AppError');
const { logger } = require('../utils/logger');

/**
 * Fixed-window rate limiter for forgot-password (Issue #10 hook; expands in #12).
 * Uses Redis INCR + EXPIRE on first hit.
 */
function rateLimitForgotPassword({ max = 5, windowSeconds = 900 } = {}) {
  return async (req, res, next) => {
    try {
      const ip = req.ip || 'unknown';
      const count = await incr(keys.rateLimitForgot(ip), windowSeconds);

      if (count > max) {
        res.setHeader('Retry-After', String(windowSeconds));
        throw new AppError('Too many requests', 429, 'RATE_LIMITED');
      }

      return next();
    } catch (err) {
      // If Redis is down, fail open for forgot? Safer for auth abuse = fail closed.
      // But ticket + HLD prefer fail-closed on Redis for security-sensitive paths.
      if (err instanceof AppError) return next(err);

      logger.error({ err: err.message }, 'forgot-password rate limit redis error');
      return next(new AppError('Service temporarily unavailable', 503, 'SERVICE_UNAVAILABLE'));
    }
  };
}

module.exports = { rateLimitForgotPassword };
