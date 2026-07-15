# Redis — Sessions, TTL & Key Schema

**Decision:** store **session / refresh-token metadata** in Redis (not PostgreSQL).  
Postgres remains the source of truth for users, roles, and email/password-reset token hashes.

| Store | Belongs here |
|-------|----------------|
| **Redis** | Active refresh sessions, access `jti` denylist, rate-limit counters |
| **PostgreSQL** | Durable user/RBAC data, verification & reset token records |

Why Redis for sessions: TTL expiry is native, revoke is `DEL`, multi-instance safe, and matches short-lived auth state. Wrong/missing TTLs are security bugs — always set expiry.

---

## Client

- Library: **ioredis**
- Config: `REDIS_URL` (e.g. `redis://localhost:6379`)
- Module: `src/redis/index.js`
- Reconnect: exponential backoff (capped); logs errors; boot failure is logged without crashing the process

Helpers:

| Helper | Behavior |
|--------|----------|
| `set(key, value, ttlSeconds?)` | JSON-serialize + optional `EX` TTL |
| `get(key)` | Fetch + JSON-parse when possible |
| `del(key)` | Delete |
| `incr(key, ttlSeconds?)` | Counter; TTL applied when key is first created |
| `ttl(key)` | Remaining seconds |
| `pingRedis()` | Health probe |

Key builders: `src/redis/keys.js` → `keys.*`

---

## Key schema

| Pattern | Helper | Purpose | Typical TTL |
|---------|--------|---------|-------------|
| `auth:refresh:{userId}:{tokenId}` | `keys.refresh` | Active refresh session metadata | ≤ refresh lifetime (7d) |
| `auth:refresh-hash:{tokenHash}` | `keys.refreshByHash` | Lookup session from cookie hash | same as refresh |
| `auth:refresh-used:{tokenHash}` | `keys.refreshUsed` | Tombstone after rotation (reuse detection) | ≤ refresh lifetime (7d) |
| `auth:deny:{jti}` | `keys.denyJti` | Access token denylist after logout | remaining access life (~15m) |
| `auth:session:{sessionId}` | `keys.session` | Optional generic session blob | as needed |
| `rl:login:{ip}:{email}` | `keys.rateLimitLogin` | Login brute-force window | env `RL_LOGIN_*` (default 15m) |
| `rl:forgot:{ip}` | `keys.rateLimitForgot` | Forgot-password throttle | env `RL_FORGOT_*` (default 15m) |
| `rl:register:{ip}` | `keys.rateLimitRegister` | Register throttle | env `RL_REGISTER_*` (default 1h) |
| `rl:resend:{ip}:{email}` | `keys.rateLimitResend` | Resend-verification throttle | env `RL_RESEND_*` (default 15m) |

Example set with TTL:

```js
const { set, keys } = require('./src/redis');

await set(
  keys.refresh(userId, tokenId),
  { familyId, userAgent, ip },
  60 * 60 * 24 * 7, // 7 days
);
```

---

## When to cache vs when not to

**Use Redis for:**
- Ephemeral auth state (sessions, denylist)
- Hot counters (rate limits)
- Data that must expire automatically

**Do not use Redis as source of truth for:**
- User accounts / passwords / roles (Postgres)
- Email verification & password-reset token records that need auditability (Postgres hashes)
- Anything that must survive Redis flush without re-login policy exceptions

---

## Graceful degradation

| Situation | Behavior |
|-----------|----------|
| Redis down on boot | Log clear error; API still starts |
| `/health/live` | Process up (alias: `/health`) |
| `/health/ready` | Returns **503** if Redis (or Postgres) is down |
| Login/refresh later | Should **fail closed** when Redis is required (Issue #08/#09) |

---

## Local Redis (Docker)

```bash
docker run --name auth-redis -p 6379:6379 -d redis:7-alpine
```

Health:

```bash
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
curl http://localhost:3000/metrics
```
