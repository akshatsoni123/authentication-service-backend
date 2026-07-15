const { config } = require('../config');

/** Cookie names used by auth */
const COOKIE = {
  ACCESS: 'access_token',
  REFRESH: 'refresh_token',
};

/**
 * Access cookie options.
 *
 * Production (HTTPS) checklist:
 *  - httpOnly: true  → browser JS cannot read the cookie (mitigates XSS token theft)
 *  - secure: true    → cookie only sent over HTTPS (set via config.isProd)
 *  - sameSite: 'lax' → reduces CSRF on cross-site navigations; use 'strict' if
 *                      the SPA is always same-site with the API
 *  - path: '/'       → access token needed on all API routes
 *
 * Local HTTP keeps secure: false so cookies work on http://localhost.
 * Never set secure: false in production behind real users.
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
 * Refresh cookie options.
 * Path limited to /api/v1/auth so the browser only sends it to auth endpoints
 * (refresh / logout), shrinking CSRF/exposure surface.
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
