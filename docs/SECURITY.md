# Security — Rate limiting & abuse defense

Authentication endpoints are high-value targets for credential stuffing and email spam.
This service uses **Redis-backed fixed-window rate limiting** so limits stay consistent
across multiple app instances (in-memory counters would not).

---

## Algorithm: fixed window

```text
Request 1 in window → INCR key → count=1 → EXPIRE key = windowSeconds
Requests 2..N      → INCR only
count > max        → 429 Too Many Requests + Retry-After
Key expires        → counter resets (new window)
```

Implemented by `incr(key, ttlSeconds)` in `src/redis/index.js` and
`rateLimit(...)` in `src/middleware/rateLimit.js`.

### Why fixed window (not sliding)

| Fixed window | Sliding window |
|--------------|----------------|
| Simple: `INCR` + `EXPIRE` | Needs sorted sets / more Lua |
| Multi-instance safe via Redis | Also Redis-safe, more CPU/memory |
| Small “double burst” at window edges | Smoother |

For auth brute-force defense, fixed window is standard and sufficient.

---

## Limits (defaults — override with env)

| Endpoint | Redis key | Default |
|----------|-----------|---------|
| `POST /api/v1/auth/login` | `rl:login:{ip}:{email}` | **5** / **15 min** |
| `POST /api/v1/auth/forgot-password` | `rl:forgot:{ip}` | **5** / **15 min** |
| `POST /api/v1/auth/register` | `rl:register:{ip}` | **10** / **1 hour** |
| `POST /api/v1/auth/resend-verification` | `rl:resend:{ip}:{email}` | **5** / **15 min** |

Login and resend use **IP + email** so attackers cannot spray one mailbox from many IPs
without separate buckets, and one IP cannot hammer many emails without multiple keys
(still IP-spammable — pair with edge WAF / CAPTCHA in production).

### Env variables

| Variable | Meaning | Default |
|----------|---------|---------|
| `RL_LOGIN_MAX` / `RL_LOGIN_WINDOW_SEC` | Login max / window | 5 / 900 |
| `RL_FORGOT_MAX` / `RL_FORGOT_WINDOW_SEC` | Forgot-password | 5 / 900 |
| `RL_REGISTER_MAX` / `RL_REGISTER_WINDOW_SEC` | Register | 10 / 3600 |
| `RL_RESEND_MAX` / `RL_RESEND_WINDOW_SEC` | Resend verification | 5 / 900 |

---

## HTTP behavior

| Status | Code | When |
|--------|------|------|
| **429** | `RATE_LIMITED` | Counter exceeded `max` |
| **503** | `SERVICE_UNAVAILABLE` | Redis error on rate-limit path (**fail-closed**) |

Successful exceed responses set:

```http
Retry-After: <seconds until window resets>
```

Value comes from Redis `TTL` on the counter key (falls back to full window if TTL missing).

Clients should back off and retry after that delay — see [API.md](./API.md).

---

## Middleware order

Abuse paths: `validate` → `rateLimit*` → controller (except forgot-password, where
IP limiter runs **before** validate so invalid bodies still consume quota).

Behind a reverse proxy, set Express `trust proxy` so `req.ip` is the real client IP.

---

## Related

- [REDIS.md](./REDIS.md) — key schema & helpers
- [AUTH.md](./AUTH.md) — forgot-password / login threats
- [HLD.md](./HLD.md) — fail-closed Redis policy
