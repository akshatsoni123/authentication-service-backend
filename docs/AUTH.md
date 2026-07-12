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

## Login vs verified (for Issue #08)

**Decision for now:** users may log in **before** email verification (easier Postman/learning).  
Login can later return `403` when `is_email_verified = false` if product requires it.
