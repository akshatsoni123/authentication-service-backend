# Authentication Service

Production-minded authentication API (Backend Roadmap **Project #3**): JWT + refresh tokens, bcrypt, RBAC, sessions, email verification, password reset — with PostgreSQL as source of truth and Redis for sessions / denylist / rate limits.

## Design docs (Issue #01)

| Doc | Contents |
|-----|----------|
| [docs/HLD.md](./docs/HLD.md) | Architecture, token strategy, cookie vs header, sequence diagrams, fault tolerance, threats, versioning |
| [docs/API.md](./docs/API.md) | Endpoint contracts, envelopes, error codes |

## Status

Design complete. Implementation follows GitHub issues #2–#19 in order.

Repo: [akshatsoni123/authentication-service-backend](https://github.com/akshatsoni123/authentication-service-backend)
