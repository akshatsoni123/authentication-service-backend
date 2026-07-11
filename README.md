# Authentication Service

Production-minded authentication API (Backend Roadmap **Project #3**): JWT + refresh tokens, bcrypt, RBAC, sessions, email verification, password reset — with PostgreSQL as source of truth and Redis for sessions / denylist / rate limits.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Health check: [http://localhost:3000/health](http://localhost:3000/health)

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start with nodemon (reload on change) |
| `npm start` | Start without reload |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Tests (placeholder until Issue #15) |

## Project structure

```text
src/
  config/          # Zod-validated env → frozen config
  db/              # PostgreSQL (Issue #03)
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

## Environment

Copy `.env.example` → `.env`. Required variables are validated on boot (fail fast). Never commit `.env`.

Repo: [akshatsoni123/authentication-service-backend](https://github.com/akshatsoni123/authentication-service-backend)
