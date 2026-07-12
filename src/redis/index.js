const Redis = require('ioredis');
const { config } = require('../config');
const { keys } = require('./keys');

/** @type {import('ioredis').Redis | null} */
let client = null;

/** @type {boolean} */
let connectAttempted = false;

function getRedisConfig() {
  return {
    url: config.redis.url,
  };
}

/**
 * Lazy singleton Redis client with reconnect strategy.
 * Does not throw on transient disconnect — callers should handle null/errors.
 */
function getRedis() {
  if (client) {
    return client;
  }

  client = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    // Exponential backoff capped at 2s
    retryStrategy(times) {
      if (times > 20) {
        console.error('[redis] giving up reconnect after repeated failures');
        return null; // stop retrying
      }
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
  });

  client.on('connect', () => {
    console.log('[redis] connecting...');
  });

  client.on('ready', () => {
    console.log('[redis] ready');
  });

  client.on('error', (err) => {
    console.error('[redis] error', err.message);
  });

  client.on('close', () => {
    console.warn('[redis] connection closed');
  });

  client.on('reconnecting', () => {
    console.warn('[redis] reconnecting...');
  });

  return client;
}

/**
 * Connect on boot. Logs a clear error if Redis is down — does not crash the process
 * (graceful degradation for non-auth routes; auth that needs Redis will fail later).
 */
async function connectRedis() {
  connectAttempted = true;
  const redis = getRedis();

  try {
    if (redis.status === 'wait' || redis.status === 'end') {
      await redis.connect();
    }
    await redis.ping();
    console.log('[redis] connected via', config.redis.url.replace(/:[^:@/]+@/, ':****@'));
    return true;
  } catch (err) {
    console.error(
      '[redis] FAILED to connect on boot — sessions/refresh/rate-limits unavailable:',
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

function isRedisReady() {
  return Boolean(client && client.status === 'ready');
}

/**
 * SET with optional TTL (seconds). Value is JSON-serialized if not a string.
 * @param {string} key
 * @param {unknown} value
 * @param {number} [ttlSeconds]
 */
async function set(key, value, ttlSeconds) {
  const redis = getRedis();
  const payload = typeof value === 'string' ? value : JSON.stringify(value);

  if (ttlSeconds && ttlSeconds > 0) {
    await redis.set(key, payload, 'EX', ttlSeconds);
  } else {
    await redis.set(key, payload);
  }
}

/**
 * GET and JSON-parse when possible.
 * @param {string} key
 * @returns {Promise<unknown|null>}
 */
async function get(key) {
  const redis = getRedis();
  const raw = await redis.get(key);
  if (raw === null) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * @param {string} key
 */
async function del(key) {
  const redis = getRedis();
  return redis.del(key);
}

/**
 * INCR counter; sets TTL only when key is new (count === 1).
 * Useful for fixed-window rate limiting.
 * @param {string} key
 * @param {number} [ttlSeconds]
 * @returns {Promise<number>} new counter value
 */
async function incr(key, ttlSeconds) {
  const redis = getRedis();
  const count = await redis.incr(key);
  if (count === 1 && ttlSeconds && ttlSeconds > 0) {
    await redis.expire(key, ttlSeconds);
  }
  return count;
}

/**
 * Remaining TTL in seconds (-1 no expiry, -2 missing).
 * @param {string} key
 */
async function ttl(key) {
  const redis = getRedis();
  return redis.ttl(key);
}

async function pingRedis() {
  try {
    if (!connectAttempted) {
      getRedis();
    }
    const redis = getRedis();
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      try {
        await redis.connect();
      } catch {
        // fall through to ping failure
      }
    }
    const pong = await redis.ping();
    return { ok: pong === 'PONG', status: redis.status };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'redis_unreachable',
      status: client?.status ?? 'unavailable',
    };
  }
}

async function closeRedis() {
  if (client) {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
    client = null;
    connectAttempted = false;
  }
}

module.exports = {
  keys,
  getRedisConfig,
  getRedis,
  connectRedis,
  isRedisReady,
  set,
  get,
  del,
  incr,
  ttl,
  pingRedis,
  closeRedis,
};
