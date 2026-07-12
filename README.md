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

## Environment

Copy `.env.example` → `.env`. Required variables are validated on boot (fail fast). Never commit `.env`.

Repo: [akshatsoni123/authentication-service-backend](https://github.com/akshatsoni123/authentication-service-backend)
