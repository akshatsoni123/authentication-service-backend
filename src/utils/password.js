const bcrypt = require('bcrypt');
const { config } = require('../config');

/**
 * Hash a plaintext password with bcrypt (cost from config, typically 10–12).
 * @param {string} plain
 * @returns {Promise<string>}
 */
async function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcrypt.saltRounds);
}

/**
 * Compare plaintext to a stored bcrypt hash.
 * @param {string} plain
 * @param {string} passwordHash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(plain, passwordHash) {
  return bcrypt.compare(plain, passwordHash);
}

module.exports = { hashPassword, verifyPassword };
