# Architecture notes

## Layering

```text
routes / controllers  →  presentation (HTTP)
services              →  domain (business rules)
repositories / db     →  data access (PostgreSQL / Redis)
```

Modules under `src/modules/*` own their routes, controllers, and services. Shared cross-cutting code lives in `src/middleware`, `src/config`, `src/utils`.

## Express middleware order

1. `helmet` — security headers  
2. `cors` — allowed origins from config  
3. `express.json` — body parser (size-limited)  
4. Feature routes (`/health`, `/api/v1/...`)  
5. `notFoundHandler`  
6. `errorHandler` — centralized errors  

Later tickets add validation, auth, rate limiting, and request IDs **before** route handlers (after parsers).

## Config boot

`src/server.js` loads `.env` via `dotenv`, then `src/config` validates with **Zod** and fails fast if required variables are missing. Application code should import `{ config }` from `src/config` — never read `process.env` ad hoc in modules.
