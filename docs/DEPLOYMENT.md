# Deployment — Nginx reverse proxy & API versioning

Production APIs rarely expose Node directly. This service uses **Nginx** as the public edge and keeps **URI versioning** at `/api/v1`.

---

## Topology

```text
Client (browser / Postman / mobile)
        │
        ▼
   Nginx :80          ← TLS :443 in production (terminate here)
        │ proxy_pass
        ▼
   Node API :3000     ← internal only in Docker Compose
        ├─► PostgreSQL
        └─► Redis
```

| Layer | Role |
|-------|------|
| **Nginx** | Public port, gzip, body size limit, forwarded headers |
| **Express** | Auth logic, validation, rate limits, `/api/v1` routes |
| **Postgres / Redis** | Durable data + sessions / rate-limit counters |

Config file: [`nginx/nginx.conf`](../nginx/nginx.conf)

---

## API versioning

**Strategy:** URL path versioning (chosen in HLD Issue #01).

```text
/api/v1/auth/*
/api/v1/users/*
/api/v1/admin/*
```

Nginx forwards `/api/` **unchanged** — no path rewriting. A future `v2` adds `app.use('/api/v2', ...)` without breaking `v1` clients.

---

## Nginx config explained

### Upstream

```nginx
upstream auth_api {
  server api:3000;   # Docker Compose service name
  keepalive 32;
}
```

`proxy_pass http://auth_api` sends traffic to the Node container on the internal network.

### Forwarded headers (required for auth)

| Header | Purpose |
|--------|---------|
| `X-Forwarded-For` | Real client IP → `req.ip` → Redis rate-limit keys |
| `X-Forwarded-Proto` | `http` / `https` → `Secure` cookies when behind TLS |
| `Host` | Correct host for CORS / links |
| `X-Request-Id` | Correlation id (optional pass-through) |

Express must trust the proxy:

```js
app.set('trust proxy', 1);  // one Nginx hop
```

Enabled when `NODE_ENV=production` **or** `TRUST_PROXY=1` (set in `docker-compose.yml`).

### Body size & gzip

- `client_max_body_size 16k` — aligns with `express.json({ limit: '10kb' })`
- `gzip on` + `gzip_types application/json` — smaller JSON responses

### Routes

| Location | Proxied to |
|----------|------------|
| `/api/` | Versioned API (`/api/v1/...`) |
| `/health/`, `/health` | Liveness / readiness probes |
| `/metrics` | Prometheus (restrict in production) |
| `/` | `404` — no accidental exposure |

---

## Docker Compose (local)

```bash
cp .env.example .env
docker compose up --build
```

| URL | Purpose |
|-----|---------|
| http://localhost/api/v1/auth/register | API via Nginx |
| http://localhost/health/live | Liveness |
| http://localhost/health/ready | Readiness (503 if DB/Redis down) |
| http://localhost:8025 | Mailpit UI |

The `api` service is **not** published on host `:3000` in the default compose file — use Nginx on **port 80**.

Hot reload + direct API debug port:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
# Nginx: http://localhost/api/v1/...
# Direct: http://localhost:3000/api/v1/... (optional)
```

### Verify proxy works

```bash
curl -s http://localhost/health/live
curl -s -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"Str0ng1Pass"}'
```

Check API logs: `req.ip` should be the Docker bridge / your machine IP, not `127.0.0.1` from inside the `api` container.

---

## HTTPS (production)

1. Obtain certificates (e.g. Let's Encrypt).
2. Mount certs into Nginx (`nginx/certs/`).
3. Uncomment the `listen 443 ssl` server block in `nginx/nginx.conf`.
4. Set env:
   - `APP_URL=https://auth.example.com`
   - `CORS_ORIGIN=https://auth.example.com`
   - `NODE_ENV=production` (enables `Secure` cookies)
5. Ensure `X-Forwarded-Proto` is `https` (Nginx sets `$scheme` when clients use TLS).

Cookie flags (`src/utils/cookies.js`):

| Flag | Production |
|------|------------|
| `httpOnly` | true |
| `secure` | true (requires HTTPS + trust proxy) |
| `sameSite` | `lax` |
| refresh `path` | `/api/v1/auth` |

---

## Environment

| Variable | Behind Nginx |
|----------|----------------|
| `TRUST_PROXY` | `1` |
| `APP_URL` | Public URL clients use (`http://localhost` or `https://...`) |
| `CORS_ORIGIN` | Same origin(s) as the browser app |

---

## Related

- [OBSERVABILITY.md](./OBSERVABILITY.md) — health probes, metrics
- [SECURITY.md](./SECURITY.md) — rate limits, cookies, trust proxy
- [HLD.md](./HLD.md) — versioning decision
- [API.md](./API.md) — `/api/v1` contracts
