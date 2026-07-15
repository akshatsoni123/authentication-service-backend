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

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start with nodemon (reload on change) |
| `npm start` | Start without reload |
| `npm run migrate` | Apply Knex migrations |
| `npm run seed` | Seed default roles / permissions |
| `npm run db:setup` | migrate + seed |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Tests (placeholder until Issue #15) |

## Project structure

```text
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

## Environment

Copy `.env.example` → `.env`. Required variables are validated on boot (fail fast). Never commit `.env`.

Security checklist and HTTPS cookie notes: [docs/SECURITY.md](./docs/SECURITY.md).

```bash
npm run audit   # production dependency scan (also planned for CI in Issue #16)
```

Repo: [akshatsoni123/authentication-service-backend](https://github.com/akshatsoni123/authentication-service-backend)
