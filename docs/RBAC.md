# RBAC (Role-Based Access Control)

Authentication answers **who you are**. Authorization answers **what you can do**.

This service uses RBAC so protected routes declare required roles/permissions via middleware instead of scattering `if (user.isAdmin)` checks.

---

## Model

| Entity | Meaning | Examples |
|--------|---------|----------|
| **Role** | Named bundle of capabilities | `user`, `moderator`, `admin` |
| **Permission** | Fine-grained action key | `users:read`, `users:list`, `roles:assign` |

Relationships (Postgres):

- `users` ↔ `roles` via `user_roles` (N:M)
- `roles` ↔ `permissions` via `role_permissions` (N:M)

Default on register: role `user` only (**least privilege**).

Seeds (`npm run seed`) create:

| Role | Permissions |
|------|-------------|
| `user` | `users:read` |
| `moderator` | `users:read`, `users:list` |
| `admin` | `users:read`, `users:write`, `users:list`, `roles:assign` |

---

## Middleware stack

Always order: **authenticate → authorize / requirePermission → handler**.

| Middleware | File | Behavior |
|------------|------|----------|
| `authenticate` | `src/middleware/authenticate.js` | Missing/invalid token → **401** `UNAUTHORIZED`. Sets `req.user = { id, roles, jti, exp }`. |
| `authorize(...roles)` | `src/middleware/authorize.js` | Authenticated but missing required role → **403** `FORBIDDEN`. Uses **JWT-embedded** roles. |
| `requirePermission(key)` | `src/middleware/authorize.js` | Same 403 if permission missing. Loads permissions from **Postgres** for the user. |

### 401 vs 403

| Status | When |
|--------|------|
| **401** | No token, bad/expired token, denylisted `jti`, or `authenticate` never ran |
| **403** | Valid identity, but role/permission check failed |

Never return 401 for “logged in but not admin” — that confuses clients into thinking they should re-login.

---

## JWT roles vs DB lookup

| Approach | Used by | Pros | Cons |
|----------|---------|------|------|
| Embed `roles` in access JWT | `authorize()` | Fast; no DB hit per request | Role revoke delayed until access token expires (~15m) or client refreshes |
| Load from Postgres | `requirePermission()` | Immediate; matches DB source of truth | Extra latency; depends on DB health |

**This service:**

- Login/refresh put role **names** into the access JWT (`signAccessToken`).
- Admin route protection uses `authorize('admin')` (JWT) for the learning path in HLD.
- `requirePermission('users:list')` is available when you need permission-level or immediate checks.

After `PATCH /admin/users/:id/roles`, the target user’s **existing** access JWT still carries old roles until it expires. Clients should refresh or re-login; the API response includes a short note.

For high-sensitivity actions you can combine both: `authenticate` → `authorize('admin')` → optional DB re-check inside the service.

---

## Protected endpoints

| Method | Path | AuthZ |
|--------|------|--------|
| `GET` | `/api/v1/users/me` | Any authenticated user (`authenticate` only) |
| `GET` | `/api/v1/admin/users` | `authenticate` + `authorize('admin')` |
| `PATCH` | `/api/v1/admin/users/:id/roles` | `authenticate` + `authorize('admin')` |

### Assigning roles

1. **Seed / SQL** (bootstrap first admin):

```sql
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE u.email = 'admin@example.com' AND r.name = 'admin'
ON CONFLICT DO NOTHING;
```

Then log in again so the new access token includes `"admin"`.

2. **Admin API:** `PATCH /api/v1/admin/users/:id/roles` with body `{ "roles": ["user", "admin"] }`.

---

## Principle of least privilege

- New users get `user` only.
- Admin routes require the `admin` role explicitly.
- Never trust roles from the request body for authorization — only JWT (`authorize`) or DB (`requirePermission` / role assignment writes).
- Permission keys stay small and action-oriented (`resource:action`).

---

## Related docs

- [HLD.md](./HLD.md) § AuthZ overview
- [API.md](./API.md) admin endpoints
- [DATABASE.md](./DATABASE.md) ER diagram
