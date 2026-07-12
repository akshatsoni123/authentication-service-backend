/**
 * Central Redis key naming — keep patterns here so auth/rate-limit code stays consistent.
 * See docs/REDIS.md for TTL decisions and when NOT to use Redis.
 */
const keys = {
  /** Active refresh session metadata */
  refresh: (userId, tokenId) => `auth:refresh:${userId}:${tokenId}`,

  /** Optional: map token hash → session pointer for lookup by cookie value hash */
  refreshByHash: (tokenHash) => `auth:refresh-hash:${tokenHash}`,

  /** Access JWT denylist after logout (jti) */
  denyJti: (jti) => `auth:deny:${jti}`,

  /** Generic session blob if needed beyond refresh */
  session: (sessionId) => `auth:session:${sessionId}`,

  /** Rate limits */
  rateLimitLogin: (ip, email) => `rl:login:${ip}:${email}`,
  rateLimitForgot: (ip) => `rl:forgot:${ip}`,
  rateLimitRegister: (ip) => `rl:register:${ip}`,
};

module.exports = { keys };
