# Learning Guide & Runbook (Project 03 Wrap-up)

This guide maps roadmap concepts to concrete modules in this repository so a new contributor (or interviewer) can quickly verify implementation depth.

## 1) Auth concepts -> where to read code

| Concept | Primary code pointers |
|--------|------------------------|
| Register + verify email | `src/modules/auth/auth.routes.js`, `src/modules/auth/auth.controller.js`, `src/modules/auth/auth.service.js`, `src/modules/auth/auth.repository.js`, `src/services/email.service.js` |
| Login + access JWT | `src/modules/auth/auth.service.js`, `src/utils/jwt.js`, `src/middleware/authenticate.js` |
| Refresh sessions + rotation + reuse detection | `src/services/session.service.js`, `src/modules/auth/auth.service.js`, `src/redis/keys.js` |
| Logout + denylist | `src/services/session.service.js`, `src/middleware/authenticate.js` |
| Forgot/reset password | `src/modules/auth/auth.validation.js`, `src/modules/auth/auth.service.js`, `src/modules/auth/auth.repository.js`, `src/services/email.service.js` |
| RBAC admin allow/user deny | `src/middleware/authorize.js`, `src/modules/users/admin.routes.js`, `src/modules/roles/roles.service.js` |

## 2) PostgreSQL concepts

| Concept | Where implemented |
|--------|--------------------|
| Schema design (users, roles, tokens, audit) | `src/db/migrations/20260711120000_init_auth_schema.js` |
| Indexes/uniques/constraints | same migration file (`table.index`, `table.unique`, FK constraints) |
| Transactions | `src/db/index.js` (`withTransaction`) + auth repository methods using it |
| Connection pooling | `src/db/index.js` (`Pool` config from `src/config/index.js`) |
| Seeded RBAC model | `src/db/seeds/01_roles_and_permissions.js` |

## 3) Redis concepts

| Concept | Where implemented |
|--------|--------------------|
| Redis client lifecycle, helper ops, TTL | `src/redis/index.js` |
| Key naming strategy | `src/redis/keys.js` |
| Session + denylist + reuse tombstones | `src/services/session.service.js` |
| Rate limiting counters (INCR + EXPIRE) | `src/middleware/rateLimit.js` |

## 4) Security middleware stack

| Concept | Where implemented |
|--------|--------------------|
| Helmet / CORS / JSON body limits | `src/app.js` |
| Request validation (Zod) | `src/middleware/validate.js` + `src/modules/auth/auth.validation.js` + admin validation files |
| Authentication | `src/middleware/authenticate.js` |
| Authorization (roles/permissions) | `src/middleware/authorize.js` |
| Structured logging + redaction | `src/utils/logger.js`, `src/middleware/requestId.js`, `src/middleware/errorHandler.js` |

## 5) Ops & delivery

| Concept | Where implemented |
|--------|--------------------|
| Docker multi-stage + non-root | `Dockerfile` |
| Compose stack (nginx/api/postgres/redis/mailpit) | `docker-compose.yml`, `docker-compose.dev.yml` |
| Container startup runbook (wait + migrate/seed) | `scripts/docker-entrypoint.js` |
| Reverse proxy + forwarded headers | `nginx/nginx.conf`, `docs/DEPLOYMENT.md` |
| CI pipeline (lint/test/docker build) | `.github/workflows/ci.yml` |

## 6) Testing map

| Test area | Files |
|----------|-------|
| Unit helpers | `tests/password.test.js`, `tests/jwt.test.js`, `tests/tokens.test.js` |
| Middleware behavior | `tests/authorize.test.js`, `tests/rateLimit.test.js` |
| Health/metrics | `tests/health.metrics.test.js` |
| Full auth integration matrix | `tests/auth.api.test.js` |
| Test harness setup | `tests/setup/*.js`, `.env.test.example`, `tests/helpers/*.js` |

## 7) Endpoint runbook (quick command list)

Base (local Node): `http://localhost:3000`  
Base (compose via Nginx): `http://localhost`

Core lifecycle:

1. `POST /api/v1/auth/register`
2. `POST /api/v1/auth/verify-email`
3. `POST /api/v1/auth/login`
4. `GET /api/v1/users/me`
5. `POST /api/v1/auth/refresh`
6. `POST /api/v1/auth/logout`
7. `POST /api/v1/auth/forgot-password`
8. `POST /api/v1/auth/reset-password`

See detailed payloads: `docs/API.md`  
Automated curl flow: `scripts/curl-auth-lifecycle.sh`

## 8) Project #3 acceptance self-check

Use this section as a final checklist before presenting the project:

- [x] PostgreSQL schema with users/roles/tokens and migration history
- [x] Transactional auth writes and password hashing
- [x] JWT access + Redis-backed refresh sessions with rotation/reuse defense
- [x] RBAC-protected admin routes
- [x] Forgot/reset password flow with anti-enumeration behavior
- [x] Security middleware (helmet/cors/validation/rate limits/logging)
- [x] Automated tests (unit + integration + API)
- [x] Dockerized local stack with readiness/liveness checks
- [x] CI pipeline for lint/test/docker build
- [x] Documentation and runbooks for onboarding/operations

## 9) Known limitations / what to build next

1. Add Prometheus + Grafana containers and dashboards.
2. Add OpenAPI schema generation + SDK docs.
3. Add registry push and deployment workflow after CI.
4. Add email retry queue and dead-letter handling.
5. Add load/perf tests for auth endpoints.
