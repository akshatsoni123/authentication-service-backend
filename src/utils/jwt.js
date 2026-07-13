const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { config } = require('../config');

/**
 * Create a short-lived access JWT.
 *
 * Claims (keep small):
 *  - sub   = user id
 *  - roles = string[] (e.g. ["user"])
 *  - jti   = unique token id (used later for logout denylist in Redis)
 *  - iat / exp = added by jsonwebtoken from expiresIn
 */
function signAccessToken({ userId, roles }) {
  // Random id for this specific access token
  const jti = crypto.randomUUID();

  // expiresIn comes from env as seconds (e.g. 900 = 15 minutes)
  const token = jwt.sign(
    { sub: userId, roles, jti },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn },
  );

  return { token, jti, expiresIn: config.jwt.accessExpiresIn };
}

/**
 * Verify access JWT signature + expiry.
 * Throws TokenExpiredError / JsonWebTokenError if bad — caller maps to 401.
 */
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

module.exports = { signAccessToken, verifyAccessToken };
