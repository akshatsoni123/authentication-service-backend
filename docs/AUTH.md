# Auth product decisions

## Email verification (Issue #07)

- Tokens are opaque random strings; **only SHA-256 hashes** are stored in Postgres.
- Tokens expire after **24 hours** and are **single-use** (`used_at` set on first success).
- **`POST /api/v1/auth/verify-email` is idempotent:**  
  - 1st success → `200` `"Email verified successfully."`  
  - Later calls with the same consumed token → `200` `"Email already verified."`  
  - Unknown / expired-unused tokens → `400`
- Email is sent via **Nodemailer** using `SMTP_*` env (Mailtrap) or **Ethereal** automatically in development when `SMTP_USER` / `SMTP_PASS` are empty.
- Registration still succeeds if SMTP fails (logged); use `POST /api/v1/auth/resend-verification`.
- **Resend rate limiting** is deferred to Issue #12.

## Login vs verified (Issue #08)

**Decision for now:** users may log in **before** email verification (easier Postman/learning).  
Login can later return `403` when `is_email_verified = false` if product requires it.

## Access token delivery: Bearer header vs cookies (Issue #08)

| Mechanism | Where | Pros | Cons |
|-----------|--------|------|------|
| **Bearer header** | `Authorization: Bearer <accessJwt>` | Easy in Postman/mobile; explicit | If stored in `localStorage`, XSS can steal it |
| **httpOnly cookie** | `access_token` / `refresh_token` | Not readable by JS → better vs XSS | Needs CORS `credentials`; CSRF care (`SameSite`) |

**This project uses both:**
- Login response JSON includes `accessToken` for Bearer use.
- Login also sets cookies:
  - `access_token` — httpOnly, `SameSite=Lax`, `Secure` in production, path `/`
  - `refresh_token` — httpOnly, `SameSite=Lax`, `Secure` in production, path `/api/v1/auth`

`GET /api/v1/users/me` accepts Bearer **or** the access cookie via `authenticate` middleware.

JWT access claims: `sub` (user id), `roles`, `jti`, plus `iat`/`exp` (lifetime from `JWT_ACCESS_EXPIRES_IN`, default 15m).

## Refresh rotation & reuse detection (Issue #09)

### Roles
| Token | Lifetime | Storage |
|-------|----------|---------|
| Access JWT | ~15m | Stateless (+ Redis `auth:deny:{jti}` on logout) |
| Refresh (opaque) | ~7d | Cookie (raw) + Redis (hash + metadata) |

### Redis keys
| Key | Purpose |
|-----|---------|
| `auth:refresh:{userId}:{tokenId}` | Active session metadata (familyId, hash, ip, …) |
| `auth:refresh-hash:{tokenHash}` | Lookup session from cookie |
| `auth:refresh-used:{tokenHash}` | Tombstone after rotation (reuse → theft) |
| `auth:deny:{jti}` | Access denylist until JWT `exp` |

TTL on refresh keys = `JWT_REFRESH_EXPIRES_IN` (must match cookie maxAge).

### Rotation flow (`POST /api/v1/auth/refresh`)
1. Read `refresh_token` cookie → hash → lookup Redis.
2. If not found but tombstone exists → **reuse detected** → revoke entire **family** → `401`.
3. Delete old session keys + write tombstone.
4. Issue new access JWT + new refresh (same `familyId`).
5. Set new cookies; old refresh cannot be reused.

### Logout
- `POST /api/v1/auth/logout` — delete this refresh session + denylist current access `jti`.
- `POST /api/v1/auth/logout-all` — wipe all `auth:refresh:{userId}:*` for the user.

### Threat model (token theft)
| Stolen | Impact | Mitigation |
|--------|--------|------------|
| Access JWT | API access until `exp` (~15m) | Short TTL; logout denylist by `jti` |
| Refresh cookie | Attacker can mint new access tokens | Rotation: one-time use; reuse of old refresh revokes the whole family |
| Both | Full session takeover until logout-all / expiry | httpOnly + Secure cookies; HTTPS in prod |

**Mental model:** refresh = long-lived *capability* stored in Redis. Each use burns the old capability and issues a new one. If an attacker and the victim both try to use the same refresh, the second use fails and the family is burned.

## Password reset (Issue #10)

### Endpoints
| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/auth/forgot-password` | Body: `{ "email" }` — **always** `200` with the same message (anti-enumeration). Rate-limited per IP (see [SECURITY.md](./SECURITY.md); defaults 5 / 15m, `rl:forgot:{ip}`). |
| `POST` | `/api/v1/auth/reset-password` | Body: `{ "token", "newPassword" }` — same password policy as register. |

### Flow
1. **Forgot:** if an **active** user exists for that email, invalidate unused prior reset tokens, insert a new hashed token (1h TTL), email the raw token.
2. Unknown / inactive emails still return the same generic success message (no account oracle).
3. **Reset:** hash incoming token → lookup; reject if missing / used / expired / user not `active` with one opaque `400`.
4. In a DB transaction: update `users.password_hash` (bcrypt), set `used_at` on the token (and siblings).
5. **Revoke all Redis refresh sessions** for that user; clear access/refresh cookies on the response.

### Security notes
- Only **SHA-256 hashes** of reset tokens are stored (same pattern as email verify).
- Shared `passwordSchema` for register and reset.
- After reset, old password and old refresh cookies no longer work — user must log in again.
- Broader rate limits (login, resend) land in Issue #12; forgot already uses Redis `INCR`.
