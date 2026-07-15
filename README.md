# Authentication Service

Production-minded authentication API (Backend Roadmap **Project #3**): JWT + refresh tokens, bcrypt, RBAC, sessions, email verification, password reset — with PostgreSQL as source of truth and Redis for sessions / denylist / rate limits.

## Quick start

```bash
cp .env.example .env
npm install
# Start Postgres + Redis (see docs/DATABASE.md and docs/REDIS.md), then:
npm run db:setup
npm run dev
```

Health check: [http://localhost:3000/health](http://localhost:3000/health)

## Docker Compose (Issue #16)

Runs **API + PostgreSQL + Redis + Mailpit** with one command (multi-stage Alpine image, non-root user, migrate/seed on boot).

```bash
cp .env.example .env
# If you previously ran ad-hoc containers on 5432/6379:
#   docker stop auth-pg auth-redis
docker compose up --build
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000/health/live | API liveness |
| http://localhost:3000/health/ready | Postgres + Redis readiness |
| http://localhost:8025 | Mailpit (catch verification / reset emails) |

Compose overrides `DATABASE_URL` / `REDIS_URL` / `SMTP_*` to use service hostnames (`postgres`, `redis`, `mail`). JWT and other secrets still come from your `.env`.

Hot reload (bind-mount `src` + nodemon):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Register (Issue #06): `POST http://localhost:3000/api/v1/auth/register`
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

## Project structure

```text
Dockerfile                 # multi-stage Node Alpine (Issue #16)
docker-compose.yml         # api + postgres + redis + mailpit
docker-compose.dev.yml     # optional nodemon bind-mount
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

## Environment

Copy `.env.example` → `.env`. Required variables are validated on boot (fail fast). Never commit `.env`.

Security checklist and HTTPS cookie notes: [docs/SECURITY.md](./docs/SECURITY.md).

```bash
npm run audit   # production dependency scan (also planned for CI in Issue #16)
```

Repo: [akshatsoni123/authentication-service-backend](https://github.com/akshatsoni123/authentication-service-backend)
