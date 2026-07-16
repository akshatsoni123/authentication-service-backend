# Security hardening

Auth services are high-value targets. This document is the **defense-in-depth checklist**,
rate-limit reference, and deployment notes for HTTPS / secrets.

Status legend: **Done** · **Partial** · **Planned** (later ticket)

---

## Checklist (Issue #13)

| Control | Status | Where / notes |
|---------|--------|---------------|
| Parameterized SQL only (no string-concat user input) | **Done** | All `pg` queries use `$1…$n` placeholders (`auth.repository`, `roles.service`, `users.service`) |
| Zod validation at API boundary | **Done** | `validate()` + schemas in `auth.validation` / `admin.validation` |
| Rate limits on abuse endpoints | **Done** | login, register, forgot-password, resend — see [Rate limiting](#rate-limiting--abuse-defense) |
| Helmet security headers | **Done** | `helmet()` in `src/app.js`; API returns JSON only (default CSP sufficient) |
| CORS allowlist + credentials | **Done** | `CORS_ORIGIN` env → `cors({ credentials: true })` |
| Secrets via env only (never commit `.env`) | **Done** | Zod fail-fast in `src/config`; `.gitignore` blocks `.env`, keys, credential files |
| Least data in JWT | **Done** | Access token claims: `sub`, `roles[]`, `jti` only — no email/password/PII |
| httpOnly / Secure / SameSite cookies | **Done** | `src/utils/cookies.js`; `secure: true` when `NODE_ENV=production` |
| XSS-safe email | **Done** | Nodemailer sends **plaintext** (`text`) only — no HTML templates to inject |
| Password hashing (bcrypt) | **Done** | `src/utils/password.js`; cost from `BCRYPT_SALT_ROUNDS` |
| Opaque tokens hashed at rest | **Done** | Email verify + password reset: SHA-256 hashes in Postgres |
| Refresh rotation + reuse detection | **Done** | Redis sessions; stolen refresh → family revoke |
| Logging redaction | **Done** | Pino redacts passwords, tokens, `Authorization`, cookies |
| Error leakage control | **Done** | Prod hides 500 internals (`errorHandler`) |
| Trust proxy (real client IP) | **Done** | `TRUST_PROXY=1` or `NODE_ENV=production` → `trust proxy` 1 hop |
| Dependency audit script | **Done** | `npm run audit` (CI wire-up planned in Issue #16 Docker/CI) |
| Temporary account lockout | **Partial** | Rate limits cover burst abuse; optional lockout not implemented |
| npm audit clean (0 high) | **Partial** | See [Dependency audit](#dependency-audit); upgrade path documented |

---

## SQL injection prevention

**Rule:** never build SQL with string concatenation / template literals that include user input.

```js
// Good — parameterized
await query(`SELECT id FROM users WHERE email = $1`, [email]);

// Bad — never do this
await query(`SELECT id FROM users WHERE email = '${email}'`);
```

Runtime access uses the `pg` pool (`src/db/index.js`). Knex is used for **migrations/seeds only**, not ad-hoc authenticated queries.

**Verified:** repository/service SQL is parameterized end-to-end.

---

## XSS awareness

| Surface | Risk | Mitigation |
|---------|------|------------|
| JSON API responses | Low (clients must not `innerHTML` raw fields) | No HTML rendering in this service |
| Email bodies | Medium if HTML | We send **text-only** mail (`email.service.js`) |
| Cookies stolen via XSS | High if JS-readable | `httpOnly: true` on access + refresh |

If HTML emails are added later: escape all dynamic fields (or use a strict template library) and prefer links that open your known `APP_URL` origin only.

---

## Helmet, CORS, body limits

From `src/app.js` (order matters):

1. `requestId`
2. **`helmet()`** — `X-Content-Type-Options`, `X-Frame-Options`, etc.
3. **`cors`** — allowlist from `CORS_ORIGIN`; `credentials: true` for cookie flows
4. **`express.json({ limit: '10kb' })`** — reduces oversized-body DoS
5. `cookieParser` → logger → routes

Do **not** use `CORS_ORIGIN=*` with credentialed cookies in production.

---

## JWT: least data

Access JWT payload (`signAccessToken`):

| Claim | Purpose |
|-------|---------|
| `sub` | User id |
| `roles` | Role names for `authorize()` |
| `jti` | Logout denylist key |
| `iat` / `exp` | Lifetime |

**Not in JWT:** email, password hash, permissions list, refresh token, PII.

Refresh tokens are **opaque** (not JWTs) and live in Redis.

---

## Cookie flags (HTTPS deployment)

| Flag | Access cookie | Refresh cookie | Why |
|------|---------------|----------------|-----|
| `httpOnly` | ✓ | ✓ | Blocks `document.cookie` theft |
| `secure` | ✓ in prod | ✓ in prod | HTTPS only |
| `sameSite` | `lax` | `lax` | CSRF reduction |
| `path` | `/` | `/api/v1/auth` | Refresh only sent to auth routes |
| `maxAge` | access TTL | refresh TTL | Aligns with JWT/Redis lifetimes |

**Production deploy:**

1. Terminate TLS at Nginx (or load balancer).
2. Set `NODE_ENV=production` so `secure: true`.
3. Ensure `trust proxy` sees the client (already on in prod).
4. Prefer Bearer access tokens for pure mobile/SPA API clients if cookies are unused.

See `src/utils/cookies.js`.

---

## Secret management

| Secret | Env var | Notes |
|--------|---------|-------|
| Postgres | `DATABASE_URL` | Never log full URL with password |
| Redis | `REDIS_URL` | Strip password in boot logs (already redacted pattern) |
| JWT access | `JWT_ACCESS_SECRET` | ≥32 chars; **rotate** on compromise (invalidates all access tokens) |
| JWT refresh | `JWT_REFRESH_SECRET` | Required by config; refresh tokens are opaque — still treat as sensitive |
| SMTP | `SMTP_USER` / `SMTP_PASS` | Optional in local (Ethereal) |

**Hygiene:**

- Commit `.env.example` only; never `.env` (enforced by `.gitignore`).
- After a leak: rotate `JWT_*_SECRET`, revoke Redis refresh sessions, force re-login.
- Generate secrets: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`

---

## Input validation map

| Endpoint | Validation | Rate limit |
|----------|------------|------------|
| `POST /auth/register` | ✓ | ✓ IP |
| `POST /auth/login` | ✓ | ✓ IP+email |
| `POST /auth/verify-email` | ✓ | — (high-entropy token) |
| `POST /auth/resend-verification` | ✓ | ✓ IP+email |
| `POST /auth/forgot-password` | ✓ | ✓ IP |
| `POST /auth/reset-password` | ✓ | — (high-entropy token) |
| `POST /auth/refresh` | cookie | — |
| `POST /auth/logout` | authenticate | — |
| `GET /users/me` | authenticate | — |
| `GET /admin/users` | authenticate + authorize | — |
| `PATCH /admin/users/:id/roles` | authenticate + authorize + Zod | — |

---

## Dependency audit

```bash
npm run audit      # production deps only
npm run audit:all  # includes devDependencies
```

**Current notes (run locally to refresh):** `nodemailer` and transitive `tar` (via `bcrypt` / `node-pre-gyp`) may report high severity. Prefer intentional upgrades (`nodemailer@^9`, `bcrypt@^6`) after smoke-testing email + login — do not blind `npm audit fix --force` on main.

**CI:** wire `npm run audit` into the pipeline in **Issue #16** (Docker & Compose).

---

## Rate limiting & abuse defense

Authentication endpoints are high-value targets for credential stuffing and email spam.
This service uses **Redis-backed fixed-window rate limiting** so limits stay consistent
across multiple app instances (in-memory counters would not).

### Algorithm: fixed window

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

### Limits (defaults — override with env)

| Endpoint | Redis key | Default |
|----------|-----------|---------|
| `POST /api/v1/auth/login` | `rl:login:{ip}:{email}` | **5** / **15 min** |
| `POST /api/v1/auth/forgot-password` | `rl:forgot:{ip}` | **5** / **15 min** |
| `POST /api/v1/auth/register` | `rl:register:{ip}` | **10** / **1 hour** |
| `POST /api/v1/auth/resend-verification` | `rl:resend:{ip}:{email}` | **5** / **15 min** |

| Variable | Meaning | Default |
|----------|---------|---------|
| `RL_LOGIN_MAX` / `RL_LOGIN_WINDOW_SEC` | Login max / window | 5 / 900 |
| `RL_FORGOT_MAX` / `RL_FORGOT_WINDOW_SEC` | Forgot-password | 5 / 900 |
| `RL_REGISTER_MAX` / `RL_REGISTER_WINDOW_SEC` | Register | 10 / 3600 |
| `RL_RESEND_MAX` / `RL_RESEND_WINDOW_SEC` | Resend verification | 5 / 900 |

### HTTP behavior

| Status | Code | When |
|--------|------|------|
| **429** | `RATE_LIMITED` | Counter exceeded `max` |
| **503** | `SERVICE_UNAVAILABLE` | Redis error on rate-limit path (**fail-closed**) |

`Retry-After` = remaining Redis TTL (or full window if TTL missing).

Abuse paths: `validate` → `rateLimit*` → controller (except forgot-password, where the IP limiter runs **before** validate so invalid bodies still consume quota).

---

## Related docs

- [REDIS.md](./REDIS.md) — key schema & helpers
- [AUTH.md](./AUTH.md) — verify / reset / cookie decisions
- [RBAC.md](./RBAC.md) — 401 vs 403, JWT role trade-offs
- [HLD.md](./HLD.md) — threats & fail-closed Redis policy
- [API.md](./API.md) — client-facing error codes
