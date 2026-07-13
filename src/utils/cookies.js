const { config } = require('../config');

/** Cookie names used by auth */
const COOKIE = {
  ACCESS: 'access_token',
  REFRESH: 'refresh_token',
};

/**
 * Access cookie options.
 * - httpOnly: browser JS cannot read it (helps vs XSS stealing tokens)
 * - secure: HTTPS only in production (false on local HTTP)
 * - sameSite: 'lax' reduces CSRF risk for typical browser flows
 */
function accessCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: config.jwt.accessExpiresIn * 1000, // ms
    path: '/',
  };
}

/**
 * Refresh cookie options (full Redis rotation comes in Issue #09).
 * Path limited to /api/v1/auth so it is only sent to auth endpoints.
 */
function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: config.jwt.refreshExpiresIn * 1000,
    path: '/api/v1/auth',
  };
}

module.exports = { COOKIE, accessCookieOptions, refreshCookieOptions };
