# Authentication Service

Production-minded authentication API (Backend Roadmap **Project #3**): JWT + refresh tokens, bcrypt, RBAC, sessions, email verification, password reset — with PostgreSQL as source of truth and Redis for sessions / denylist / rate limits.

## Overview

This service provides a complete authentication lifecycle suitable for a production-style backend project:

- Register + email verification
- Login + short-lived access JWT
- Refresh token rotation with reuse detection
- Logout / logout-all session revocation
- Forgot/reset password with single-use expiring tokens
- RBAC-protected admin routes

If you are onboarding to the codebase, use this README for run commands and examples, then use [`docs/LEARNING.md`](./docs/LEARNING.md) for concept-to-code pointers.

## Architecture (high level)

```text
Client -> Nginx (optional) -> Express API (/api/v1)
                           -> PostgreSQL (source of truth)
                           -> Redis (sessions, denylist, rate limits)
                           -> SMTP/Mailpit (verification + reset emails)
```

- API lifecycle and sequence diagrams: [`docs/HLD.md`](./docs/HLD.md)
- Endpoint contracts: [`docs/API.md`](./docs/API.md)
- Deployment/proxy notes: [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

## Quick start

**Option A — Docker (Nginx + full stack):** see [Docker Compose](#docker-compose-issue-16--17) below.

**Option B — Local Node:**

```bash
cp .env.example .env
npm install
# Start Postgres + Redis (see docs/DATABASE.md and docs/REDIS.md), then:
npm run db:setup
npm run dev
```

Health: http://localhost:3000/health/live

## Docker Compose (Issue #16 + #17)

Runs **Nginx → API + PostgreSQL + Redis + Mailpit** with one command (multi-stage Alpine image, non-root user, migrate/seed on boot).

```bash
cp .env.example .env
docker compose up --build
```

| URL | Purpose |
|-----|---------|
| http://localhost/api/v1/... | **Public API via Nginx** (port 80) |
| http://localhost/health/live | Liveness through proxy |
| http://localhost/health/ready | Readiness (Postgres + Redis) |
| http://localhost:8025 | Mailpit (catch verification / reset emails) |

Compose sets `TRUST_PROXY=1`, `APP_URL=http://localhost`, and internal `DATABASE_URL` / `REDIS_URL` / `SMTP_*`. JWT secrets still come from `.env`.

Hot reload (bind-mount `src` + nodemon; also exposes API :3000 for direct debug):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Nginx + proxy details: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

Register via Nginx: `POST http://localhost/api/v1/auth/register`

## API examples (local Node on :3000)
```json
{ "email": "you@example.com", "password": "Str0ng1Pass" }
```

Verify email (Issue #07): `POST http://localhost:3000/api/v1/auth/verify-email`
```json
{ "token": "<token-from-email-or-dev-logs>" }
```

Resend: `POST http://localhost:3000/api/v1/auth/resend-verification` `{ "email": "you@example.com" }`

Login: `POST http://localhost:3000/api/v1/auth/login`
```json
{ "email": "you@example.com", "password": "Str0ng1Pass" }
```
Then `GET http://localhost:3000/api/v1/users/me` with header `Authorization: Bearer <accessToken>`.

Refresh (cookie jar / `-c`/`-b` curl): `POST http://localhost:3000/api/v1/auth/refresh`  
Logout: `POST http://localhost:3000/api/v1/auth/logout` (Bearer required)  
Logout all: `POST http://localhost:3000/api/v1/auth/logout-all`

Forgot password: `POST http://localhost:3000/api/v1/auth/forgot-password` `{ "email": "you@example.com" }`  
(In dev, copy `passwordResetToken` from server logs.)  
Reset: `POST http://localhost:3000/api/v1/auth/reset-password`
```json
{ "token": "<token-from-email-or-dev-logs>", "newPassword": "N3wStr0ngPass" }
```

See [docs/AUTH.md](./docs/AUTH.md) for verify, cookies, refresh rotation, reuse detection, and password reset.

## Running tests (Issue #15)

Tests use **Jest** + **Supertest** against a dedicated Postgres DB and Redis DB index (not your Postman data).

1. Ensure Postgres + Redis are running (same Docker containers as local dev are fine).
2. Copy env: `cp .env.test.example .env.test` (already points at `auth_service_test` + Redis `/1`).
3. Run: `npm test`

In GitHub Actions (Issue #18), the workflow sets equivalent env vars (no `.env.test` file needed in CI).
Required CI env vars:
```text
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/auth_service_test
REDIS_URL=redis://localhost:6379/1
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
CORS_ORIGIN=http://localhost:3000
SMTP_HOST=localhost
SMTP_FROM=...
```

`jest` **globalSetup** creates `auth_service_test` if missing, then runs migrations + role seeds. Each API test truncates user tables and flushes Redis DB 1.

- Unit: password, JWT, opaque tokens, `authorize`, rate-limit middleware, health/metrics  
- API: register→verify→login→me, bad password, refresh reuse, logout, forgot/reset, RBAC, validation 400, login 429  

Coverage: `npm run test:coverage` (auth module + key middleware/utils).

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start with nodemon (reload on change) |
| `npm start` | Start without reload |
| `npm run migrate` | Apply Knex migrations |
| `npm run seed` | Seed default roles / permissions |
| `npm run db:setup` | migrate + seed |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Jest unit + Supertest API tests (Issue #15) |
| `npm run test:watch` | Jest watch mode |
| `npm run test:coverage` | Jest with coverage report |

Docker: `docker compose up --build` (see section above). Dev overlay: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build`.

## Environment variables (operator runbook)

Copy `.env.example` to `.env` and adjust for your environment.

| Variable | Required | What it controls |
|----------|----------|------------------|
| `NODE_ENV` | yes | runtime mode (`development`, `test`, `production`) |
| `PORT` | yes | Express listen port |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `REDIS_URL` | yes | Redis connection string |
| `JWT_ACCESS_SECRET` | yes | signing secret for access JWT |
| `JWT_REFRESH_SECRET` | yes | validated but refresh uses opaque Redis tokens |
| `JWT_ACCESS_EXPIRES_IN` | yes | access token TTL seconds |
| `JWT_REFRESH_EXPIRES_IN` | yes | refresh session TTL seconds |
| `CORS_ORIGIN` | yes | allowed origins list |
| `SMTP_HOST` / `SMTP_PORT` | yes | email transport host/port |
| `SMTP_USER` / `SMTP_PASS` | optional in dev | SMTP auth; empty -> Ethereal fallback in dev/test |
| `SMTP_FROM` | yes | sender for verify/reset emails |
| `APP_URL` | yes | base URL embedded in email instructions |
| `TRUST_PROXY` | recommended behind proxy | enables forwarded IP/proto handling |
| `BCRYPT_SALT_ROUNDS` | recommended | password hashing cost |
| `RL_*` vars | recommended | login/register/forgot/resend rate limits |

For CI env specifically, see workflow in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

## Full auth lifecycle (curl runbook)

Use the script below to run register -> verify -> login -> me -> refresh -> forgot/reset checks:

```bash
bash scripts/curl-auth-lifecycle.sh
```

Script location: [`scripts/curl-auth-lifecycle.sh`](./scripts/curl-auth-lifecycle.sh)

## Project structure

```text
nginx/nginx.conf           # reverse proxy (Issue #17)
Dockerfile                 # multi-stage Node Alpine (Issue #16)
docker-compose.yml         # nginx + api + postgres + redis + mailpit
docker-compose.dev.yml     # optional nodemon bind-mount + api :3000
scripts/
  docker-entrypoint.js     # wait for Postgres → migrate/seed → start
src/
  config/          # Zod-validated env → frozen config
  db/
    migrations/    # Knex SQL migrations
    seeds/         # Default roles & permissions
    index.js       # pg Pool + withTransaction
  redis/           # Redis (Issue #04)
  modules/
    auth/
    users/
    roles/
  middleware/
  utils/
  routes/
  app.js           # Express app factory
  server.js        # Boot + listen
tests/
docs/
```

## Design docs

| Doc | Contents |
|-----|----------|
| [docs/HLD.md](./docs/HLD.md) | Architecture, tokens, sequences, threats |
| [docs/API.md](./docs/API.md) | Endpoint contracts |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Layering & middleware order |
| [docs/DATABASE.md](./docs/DATABASE.md) | Schema, ER diagram, pooling, ACID, migrations |
| [docs/REDIS.md](./docs/REDIS.md) | Redis keys, TTL, sessions decision, helpers |
| [docs/AUTH.md](./docs/AUTH.md) | Email verify decisions, SMTP / Ethereal |
| [docs/RBAC.md](./docs/RBAC.md) | Roles, permissions, authorize middleware, JWT vs DB |
| [docs/SECURITY.md](./docs/SECURITY.md) | Rate limits, Redis fixed window, 429 / Retry-After |
| [docs/OBSERVABILITY.md](./docs/OBSERVABILITY.md) | Health probes, logging, Prometheus `/metrics` |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Nginx reverse proxy, `/api/v1` via port 80, HTTPS notes |

## Environment

Copy `.env.example` → `.env`. Required variables are validated on boot (fail fast). Never commit `.env`.

Security checklist and HTTPS cookie notes: [docs/SECURITY.md](./docs/SECURITY.md).

```bash
npm run audit   # production dependency scan (also planned for CI in Issue #16)
```

## Known limitations / next improvements

- No real Prometheus/Grafana stack in compose yet (only `/metrics` endpoint export).
- No OpenAPI/Swagger doc generation yet (API docs are markdown-first).
- Refresh sessions are Redis-backed only; optional DB mirror can improve auditability.
- No background job queue for email retries (best-effort send + logs currently).
- CI builds Docker image but does not push to registry/deploy automatically.

## Project 03 concept self-check

Use [`docs/LEARNING.md`](./docs/LEARNING.md) as a wrap-up checklist.  
It maps each roadmap concept (JWT, refresh, RBAC, sessions, email verify/reset, Postgres indexes/transactions/pooling, Redis TTL/rate-limits, Helmet/CORS/validation/logging, Docker/Nginx/GitHub Actions) to concrete files in this repo.

Repo: [akshatsoni123/authentication-service-backend](https://github.com/akshatsoni123/authentication-service-backend)
