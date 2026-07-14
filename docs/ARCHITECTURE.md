# Architecture notes

## Layering

```text
routes / controllers  →  presentation (HTTP)
services              →  domain (business rules)
repositories / db     →  data access (PostgreSQL / Redis)
```

Modules under `src/modules/*` own their routes, controllers, and services. Shared cross-cutting code lives in `src/middleware`, `src/config`, `src/utils`.

## Express middleware order

1. `requestId` — correlation id (`X-Request-Id` / `req.id`)
2. `helmet` — security headers
3. `cors` — allowed origins from config + `credentials: true`
4. `express.json` — body parser (size-limited, e.g. `10kb`)
5. `pino-http` — structured request logs (passwords/tokens redacted)
6. Feature routes (`/health`, `/api/v1/...`) with per-route `validate(schema)`
7. `notFoundHandler`
8. `errorHandler` — centralized errors; no stack traces leaked in production

### Error envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "body.email", "message": "Invalid email" }],
    "requestId": "uuid"
  }
}
```

### Validation

Use `validate({ body, query, params })` from `src/middleware/validate.js` on each route that accepts input. Invalid payloads become `400 VALIDATION_ERROR` with field-level `details`.

### AuthN / AuthZ on routes

Per-route (not global): `authenticate` then `authorize('admin')` or `requirePermission('users:list')`. Unauthenticated → `401`; authenticated but forbidden → `403`. Details: [RBAC.md](./RBAC.md).

## Config boot

`src/server.js` loads `.env` via `dotenv`, then `src/config` validates with **Zod** and fails fast if required variables are missing. Application code should import `{ config }` from `src/config` — never read `process.env` ad hoc in modules.

## Logging

- Logger: **Pino** (`src/utils/logger.js`)
- Dev: pretty transport; Prod: JSON lines, `info` level
- Never log raw passwords, tokens, or `Authorization` / cookie headers (redact paths configured)
