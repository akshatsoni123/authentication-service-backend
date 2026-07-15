const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { config } = require('../config');

/**
 * Create a short-lived access JWT.
 *
 * Least data in token (intentional):
 *  - sub   = user id
 *  - roles = string[] (e.g. ["user"]) — enough for authorize(); not full permissions
 *  - jti   = unique token id (logout denylist in Redis)
 *  - iat / exp = added by jsonwebtoken from expiresIn
 *
 * Do NOT put email, password hashes, or PII in the JWT.
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
