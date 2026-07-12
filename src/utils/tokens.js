const crypto = require('crypto');

/**
 * Cryptographically random opaque token (sent to user once via email).
 * @param {number} [bytes]
 */
function generateOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Store only the hash at rest — never persist the raw token.
 * @param {string} rawToken
 */
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

module.exports = { generateOpaqueToken, hashToken };
