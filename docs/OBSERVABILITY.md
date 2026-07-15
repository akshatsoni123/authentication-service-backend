# Observability — Health, Logs, Metrics

Operational visibility for the authentication service: probes for orchestrators,
structured logs with correlation IDs, and Prometheus metrics.

---

## Liveness vs readiness

| Probe | Path | Meaning | Checks |
|-------|------|---------|--------|
| **Liveness** | `GET /health/live` | Process is running | None (no DB/Redis) |
| **Readiness** | `GET /health/ready` | Safe to receive traffic | Postgres **and** Redis ping |

- Liveness fails → container/orchestrator **restarts** the process.
- Readiness fails → **503**; remove from load balancer / wait until deps recover.
- Do **not** put dependency checks on liveness — a temporary Redis blip would restart healthy app processes.

`GET /health` returns the same body as `/health/live` (alias).

### Example responses

**Live `200`:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "authentication-service",
    "timestamp": "2026-07-15T07:00:00.000Z"
  }
}
```

**Ready `503` (dependency down):**
```json
{
  "success": false,
  "data": {
    "status": "not_ready",
    "database": { "ok": false, "reason": "..." },
    "redis": { "ok": true },
    "timestamp": "..."
  }
}
```

---

## Docker / Compose healthcheck

Use **readiness** for Compose/Kubernetes readiness; **liveness** for restart policy.

```yaml
# docker-compose (app service)
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/health/ready"]
  interval: 10s
  timeout: 3s
  retries: 5
  start_period: 20s
```

Kubernetes-style (concept):

```yaml
livenessProbe:
  httpGet: { path: /health/live, port: 3000 }
  periodSeconds: 10
readinessProbe:
  httpGet: { path: /health/ready, port: 3000 }
  periodSeconds: 5
```

---

## Nginx

- Proxy `/health/live`, `/health/ready`, and (optionally) `/metrics` to the Node upstream.
- **Do not cache** health or metrics responses.
- Restrict `/metrics` to the private scrape network (allowlist Prometheus IPs); do not expose it publicly.

```nginx
location /health/ {
  proxy_pass http://auth_upstream;
  proxy_http_version 1.1;
  access_log off;
}

location /metrics {
  allow 10.0.0.0/8;   # scrape CIDR
  deny all;
  proxy_pass http://auth_upstream;
}
```

---

## Structured logging

| Piece | Behavior |
|-------|----------|
| Library | Pino + `pino-http` |
| Correlation | `requestId` middleware → `X-Request-Id` header, `req.id`, log field `requestId` |
| Errors | `errorHandler` includes `requestId` in JSON body |
| Auth events | `login_success` / `login_failed` at **info** — no passwords, no raw tokens, no emails on failure |
| Noise | Health + `/metrics` access logs are skipped |

### Error tracking mindset (e.g. Sentry)

Send **5xx**, unexpected exceptions, and dependency failures. Attach `requestId` as a tag.
Do **not** send request bodies containing passwords/tokens or cookie headers.

---

## Prometheus metrics

| Endpoint | Format |
|----------|--------|
| `GET /metrics` | Prometheus text exposition (`prom-client`) |

### Custom metrics

| Name | Type | Labels |
|------|------|--------|
| `auth_login_attempts_total` | Counter | `result` (`success`\|`failure`), `reason` |
| `http_requests_total` | Counter | `method`, `route`, `status_code` |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` |

Default Node process metrics (memory, event loop, etc.) are also registered.

### Example scrape config

```yaml
scrape_configs:
  - job_name: authentication-service
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
        # or 'auth:3000' inside Docker Compose
```

### Useful queries

```promql
rate(auth_login_attempts_total{result="failure"}[5m])
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))
```

---

## Logs / metrics / tracing (basics)

| Pillar | This service |
|--------|----------------|
| **Logs** | What happened (events + `requestId`) |
| **Metrics** | How often / how slow (`/metrics`) |
| **Traces** | Not wired yet — OpenTelemetry can attach to the same `requestId` later |

Implementation: `src/metrics/index.js`, probes in `src/app.js`.
