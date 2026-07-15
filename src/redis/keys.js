/**
 * Central Redis key naming — keep patterns here so auth/rate-limit code stays consistent.
 * See docs/REDIS.md for TTL decisions and when NOT to use Redis.
 */
const keys = {
  /** Active refresh session metadata */
  refresh: (userId, tokenId) => `auth:refresh:${userId}:${tokenId}`,

  /** Lookup session from cookie hash */
  refreshByHash: (tokenHash) => `auth:refresh-hash:${tokenHash}`,

  /**
   * Short-lived tombstone after rotation.
   * If this key exists and primary session is gone → refresh reuse (theft) → revoke family.
   */
  refreshUsed: (tokenHash) => `auth:refresh-used:${tokenHash}`,

  /** Access JWT denylist after logout (jti) */
  denyJti: (jti) => `auth:deny:${jti}`,

  /** Generic session blob if needed beyond refresh */
  session: (sessionId) => `auth:session:${sessionId}`,

  /** Rate limits (fixed-window counters — see docs/SECURITY.md) */
  rateLimitLogin: (ip, email) => `rl:login:${ip}:${email}`,
  rateLimitForgot: (ip) => `rl:forgot:${ip}`,
  rateLimitRegister: (ip) => `rl:register:${ip}`,
  rateLimitResend: (ip, email) => `rl:resend:${ip}:${email}`,
};

module.exports = { keys };
