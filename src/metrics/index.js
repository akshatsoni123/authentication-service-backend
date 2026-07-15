const client = require('prom-client');

/** Shared registry — one per process (correct for single Node instance). */
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const loginAttempts = new client.Counter({
  name: 'auth_login_attempts_total',
  help: 'Login attempts by result (no emails or passwords in labels)',
  labelNames: ['result', 'reason'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

function observeLoginSuccess() {
  loginAttempts.inc({ result: 'success', reason: 'ok' });
}

/**
 * @param {string} [reason]
 */
function observeLoginFailure(reason = 'invalid_credentials') {
  loginAttempts.inc({ result: 'failure', reason });
}

/**
 * Record latency + request count. Skips /metrics and health probes to reduce noise.
 */
function metricsMiddleware(req, res, next) {
  const path = req.path || '';
  if (
    path === '/metrics' ||
    path === '/health/live' ||
    path === '/health/ready' ||
    path === '/health'
  ) {
    return next();
  }

  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path
      ? `${req.baseUrl || ''}${req.route.path}`
      : path || 'unknown';
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    end(labels);
    httpRequests.inc(labels);
  });

  return next();
}

async function metricsHandler(_req, res) {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
}

module.exports = {
  register,
  metricsMiddleware,
  metricsHandler,
  observeLoginSuccess,
  observeLoginFailure,
};
