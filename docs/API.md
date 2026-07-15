# API Design — Authentication Service

**Base path:** `/api/v1`  
**Versioning:** URI (`v1`) — see [HLD.md](./HLD.md)  
**Content-Type:** `application/json` unless noted

Related design: [HLD.md](./HLD.md)

---

## 1. Response envelopes

### Success

```json
{
  "success": true,
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

`details` is optional (used mainly for validation).

### Common error codes

| HTTP | `error.code` | When |
|------|--------------|------|
| 400 | `VALIDATION_ERROR` | Bad body/query/params |
| 401 | `UNAUTHORIZED` | Missing/invalid/expired token or bad credentials |
| 403 | `FORBIDDEN` | Authenticated but not allowed (RBAC / unverified policy) |
| 404 | `NOT_FOUND` | Resource missing |
| 409 | `CONFLICT` | Duplicate email, etc. |
| 429 | `RATE_LIMITED` | Too many requests (`Retry-After` header when possible) |
| 500 | `INTERNAL_ERROR` | Unexpected failure (no stack in production) |
| 503 | `SERVICE_UNAVAILABLE` | Dependency down (e.g. readiness) |

---

## 2. Authentication styles

| Mechanism | Usage |
|-----------|--------|
| `Authorization: Bearer <accessJwt>` | Protected routes; login response returns `accessToken` |
| Cookie `refresh_token` | httpOnly; sent on `/auth/refresh` and `/auth/logout` |
| None | Register, verify-email, login, forgot-password, reset-password |

---

## 3. Endpoints

### 3.1 Register

`POST /api/v1/auth/register`

**Auth:** none  

**Body:**

```json
{
  "email": "user@example.com",
  "password": "Str0ng-Pass!"
}
```

**Password policy (minimum):** length ≥ 8; at least one letter and one number (refine in validation ticket).

**Success:** `201 Created`

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "isEmailVerified": false,
      "roles": ["user"],
      "createdAt": "2026-07-11T12:00:00.000Z"
    },
    "message": "Registration successful. Please verify your email."
  }
}
```

**Errors:** `400` validation · `409` email taken · `429` rate limited

**Notes:** Creates user + default `user` role in a DB transaction; stores hashed email-verification token; sends email asynchronously/best-effort (see HLD fault tolerance).

---

### 3.2 Verify email

`POST /api/v1/auth/verify-email`

**Auth:** none  

**Body:**

```json
{
  "token": "<raw-token-from-email>"
}
```

**Success:** `200 OK`

```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully."
  }
}
```

**Errors:** `400` invalid/expired/used token · `429` rate limited

---

### 3.3 Login

`POST /api/v1/auth/login`

**Auth:** none  

**Body:**

```json
{
  "email": "user@example.com",
  "password": "Str0ng-Pass!"
}
```

**Success:** `200 OK`

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "isEmailVerified": true,
      "roles": ["user"]
    }
  }
}
```

**Headers:** `Set-Cookie: refresh_token=...; HttpOnly; Path=/api/v1/auth; SameSite=Lax; Secure` (Secure in production)

**Errors:** `401` invalid credentials (generic message) · `403` if product policy blocks unverified users · `429` rate limited

---

### 3.4 Refresh

`POST /api/v1/auth/refresh`

**Auth:** refresh cookie (body optional empty `{}`)

**Success:** `200 OK`

```json
{
  "success": true,
  "data": {
    "accessToken": "<new-jwt>",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

**Headers:** rotate `Set-Cookie: refresh_token=...`

**Errors:** `401` missing/invalid/reused refresh · `429` optional

---

### 3.5 Logout

`POST /api/v1/auth/logout`

**Auth:** Bearer access token recommended; refresh cookie to revoke session

**Success:** `200 OK`

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully."
  }
}
```

**Headers:** clear `refresh_token` cookie  

**Side effects:** delete Redis refresh session; denylist access `jti` until JWT expiry

**Errors:** `401` if neither valid access nor refresh presented (implementation may allow logout with refresh-only)

---

### 3.6 Forgot password

`POST /api/v1/auth/forgot-password`

**Auth:** none  

**Body:**

```json
{
  "email": "user@example.com"
}
```

**Success:** `200 OK` (always same message whether or not email exists)

```json
{
  "success": true,
  "data": {
    "message": "If an account exists for that email, a reset link has been sent."
  }
}
```

**Errors:** `400` validation · `429` rate limited

---

### 3.7 Reset password

`POST /api/v1/auth/reset-password`

**Auth:** none  

**Body:**

```json
{
  "token": "<raw-token-from-email>",
  "newPassword": "N3w-Str0ng-Pass!"
}
```

**Success:** `200 OK`

```json
{
  "success": true,
  "data": {
    "message": "Password has been reset. Please log in."
  }
}
```

**Side effects:** update bcrypt hash; invalidate reset token; revoke all Redis refresh sessions for user

**Errors:** `400` invalid/expired token or weak password · `429` rate limited

---

### 3.8 Current user

`GET /api/v1/users/me`

**Auth:** Bearer access JWT required  

**Success:** `200 OK`

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "isEmailVerified": true,
      "roles": ["user"],
      "createdAt": "2026-07-11T12:00:00.000Z"
    }
  }
}
```

**Errors:** `401` missing/invalid/expired/denylisted token

---

### 3.9 Admin — list users (RBAC example)

`GET /api/v1/admin/users`

**Auth:** Bearer access JWT + role `admin`  

**Query (optional):** `page=1&limit=20`

**Success:** `200 OK`

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "isEmailVerified": true,
        "roles": ["user"],
        "createdAt": "2026-07-11T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1
    }
  }
}
```

**Errors:** `401` unauthenticated · `403` authenticated but not admin

---

### 3.10 Admin — assign roles

`PATCH /api/v1/admin/users/:id/roles`

**Auth:** Bearer access JWT + role `admin`

**Body:**

```json
{
  "roles": ["user", "admin"]
}
```

Allowed role names: `user`, `moderator`, `admin`. At least one required. Replaces the user's existing roles.

**Success:** `200 OK`

```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "roles": ["admin", "user"],
    "note": "Role changes take effect on next login/refresh (new access token)."
  }
}
```

**Errors:** `401` unauthenticated · `403` not admin · `404` user not found · `400` validation

See [RBAC.md](./RBAC.md) for JWT vs DB trade-offs and 401 vs 403.

---

## 4. Health & metrics (non-versioned)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health/live` | Process up → `200` |
| `GET` | `/health` | Alias of `/health/live` |
| `GET` | `/health/ready` | Postgres + Redis reachable → `200`, else `503` |
| `GET` | `/metrics` | Prometheus text metrics (`prom-client`) |

JSON envelope for health, e.g. `{ "success": true, "data": { "status": "ok" } }`.  
See [OBSERVABILITY.md](./OBSERVABILITY.md) for Docker/Nginx probe usage and metric names.

---

## 5. Endpoint summary

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/v1/auth/register` | Public |
| `POST` | `/api/v1/auth/verify-email` | Public |
| `POST` | `/api/v1/auth/login` | Public |
| `POST` | `/api/v1/auth/refresh` | Refresh cookie |
| `POST` | `/api/v1/auth/logout` | Access + refresh |
| `POST` | `/api/v1/auth/forgot-password` | Public |
| `POST` | `/api/v1/auth/reset-password` | Public |
| `GET` | `/api/v1/users/me` | Bearer |
| `GET` | `/api/v1/admin/users` | Bearer + `admin` |

---

## 6. Security notes for API consumers

1. Prefer HTTPS everywhere outside local dev.  
2. Do not log `password`, `token`, or raw refresh values.  
3. Treat `401` on refresh as “re-login required” (possible reuse detection).  
4. Respect `429` and back off using `Retry-After` when present.  
5. Never send password reset or verify tokens to any origin except this API.

---

## 7. Acceptance map (Issue #01)

| Criterion | Status |
|-----------|--------|
| Endpoints listed with contracts | This document |
| Standard success/error envelope | §1 |
| Versioning `/api/v1` | Header + HLD §10 |
| Threat-related API behaviors (generic login, forgot-password message, RBAC 401 vs 403) | Per-endpoint notes |
