const crypto = require('crypto');
const { query } = require('../../src/db');
const { getRedis, connectRedis, keys } = require('../../src/redis');

/**
 * Unique email per test so parallel history / leftover rows never collide.
 */
function uniqueEmail(prefix = 'user') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.com`;
}

/**
 * Wipe user-owned tables; keep roles/permissions seeds.
 */
async function truncateAuthTables() {
  await query(`
    TRUNCATE TABLE
      password_reset_tokens,
      email_verification_tokens,
      audit_logs,
      user_roles,
      users
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Flush the Redis logical DB used by tests (db index from REDIS_URL).
 * Assumes Redis was already connected via getTestApp().
 */
async function flushTestRedis() {
  const redis = getRedis();
  if (redis.status !== 'ready') {
    await connectRedis();
  }
  await redis.flushdb();
}

/**
 * Delete common rate-limit keys for an IP (lightweight alternative to full flush).
 * @param {string} [ip]
 */
async function clearRateLimitKeys(ip = '::ffff:127.0.0.1') {
  await connectRedis();
  const redis = getRedis();
  const patterns = [
    keys.rateLimitForgot(ip),
    keys.rateLimitRegister(ip),
    `rl:login:${ip}:*`,
    `rl:resend:${ip}:*`,
  ];
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      const found = await redis.keys(pattern);
      if (found.length) await redis.del(...found);
    } else {
      await redis.del(pattern);
    }
  }
}

module.exports = {
  uniqueEmail,
  truncateAuthTables,
  flushTestRedis,
  clearRateLimitKeys,
};
