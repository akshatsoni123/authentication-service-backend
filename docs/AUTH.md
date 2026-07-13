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
  - `refresh_token` — httpOnly, `SameSite=Lax`, `Secure` in production, path `/api/v1/auth` (stub until Issue #09 Redis rotation)

`GET /api/v1/users/me` accepts Bearer **or** the access cookie via `authenticate` middleware.

JWT access claims: `sub` (user id), `roles`, `jti`, plus `iat`/`exp` (lifetime from `JWT_ACCESS_EXPIRES_IN`, default 15m).
