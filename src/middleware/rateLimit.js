const { incr, ttl, keys } = require('../redis');
const { config } = require('../config');
const { AppError } = require('../utils/AppError');
const { logger } = require('../utils/logger');

/**
 * Fixed-window Redis rate limiter.
 *
 * Pattern: INCR key; on first hit (count === 1) set EXPIRE = windowSeconds.
 * Shared Redis = same limits across every app instance (unlike in-memory stores).
 *
 * Fail-closed: Redis errors → 503 (abuse-sensitive paths must not open wide).
 *
 * @param {object} opts
 * @param {number} opts.max
 * @param {number} opts.windowSeconds
 * @param {(req: import('express').Request) => string} opts.keyFn
 * @param {string} [opts.name]
 * @param {{ incr: Function, ttl: Function }} [opts.redis]  inject for unit tests
 */
function rateLimit({ max, windowSeconds, keyFn, name = 'rate-limit', redis }) {
  const incrFn = redis?.incr ?? incr;
  const ttlFn = redis?.ttl ?? ttl;

  return async (req, res, next) => {
    try {
      const redisKey = keyFn(req);
      const count = await incrFn(redisKey, windowSeconds);

      if (count > max) {
        const remaining = await ttlFn(redisKey);
        const retryAfter = remaining > 0 ? remaining : windowSeconds;
        res.setHeader('Retry-After', String(retryAfter));
        throw new AppError('Too many requests', 429, 'RATE_LIMITED');
      }

      return next();
    } catch (err) {
      if (err instanceof AppError) return next(err);

      logger.error({ err: err.message, name }, 'rate limit redis error');
      return next(
        new AppError('Service temporarily unavailable', 503, 'SERVICE_UNAVAILABLE'),
      );
    }
  };
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function emailFromBody(req) {
  return String(req.body?.email || '')
    .trim()
    .toLowerCase();
}

function rateLimitLogin() {
  const { max, windowSeconds } = config.rateLimit.login;
  return rateLimit({
    max,
    windowSeconds,
    name: 'login',
    keyFn: (req) => keys.rateLimitLogin(clientIp(req), emailFromBody(req) || 'unknown'),
  });
}

function rateLimitForgotPassword() {
  const { max, windowSeconds } = config.rateLimit.forgot;
  return rateLimit({
    max,
    windowSeconds,
    name: 'forgot-password',
    keyFn: (req) => keys.rateLimitForgot(clientIp(req)),
  });
}

function rateLimitRegister() {
  const { max, windowSeconds } = config.rateLimit.register;
  return rateLimit({
    max,
    windowSeconds,
    name: 'register',
    keyFn: (req) => keys.rateLimitRegister(clientIp(req)),
  });
}

function rateLimitResendVerification() {
  const { max, windowSeconds } = config.rateLimit.resend;
  return rateLimit({
    max,
    windowSeconds,
    name: 'resend-verification',
    keyFn: (req) =>
      keys.rateLimitResend(clientIp(req), emailFromBody(req) || 'unknown'),
  });
}

module.exports = {
  rateLimit,
  rateLimitLogin,
  rateLimitForgotPassword,
  rateLimitRegister,
  rateLimitResendVerification,
};
