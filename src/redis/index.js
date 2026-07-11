/**
 * Redis client — wired in Issue #04.
 * Sessions, refresh tokens, denylist, and rate limits will live here.
 */
const { config } = require('../config');

function getRedisConfig() {
  return {
    url: config.redis.url,
  };
}

async function pingRedis() {
  // Placeholder until the client is implemented
  return { ok: false, reason: 'redis_not_connected_yet' };
}

module.exports = {
  getRedisConfig,
  pingRedis,
};
