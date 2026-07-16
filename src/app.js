const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const { config } = require('./config');
const { apiRouter } = require('./routes');
const { requestId } = require('./middleware/requestId');
const { notFoundHandler } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');
const { pingDatabase } = require('./db');
const { pingRedis } = require('./redis');
const { logger } = require('./utils/logger');
const { metricsMiddleware, metricsHandler } = require('./metrics');

function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Behind Nginx: trust one proxy hop so req.ip / Secure cookies use X-Forwarded-*.
  // TRUST_PROXY=1 in Docker Compose; production also enables this when NODE_ENV=production.
  if (config.isProd || config.trustProxy) {
    app.set('trust proxy', 1);
  }

  // Order: requestId → helmet → cors → json → cookies → http logger → metrics → routes
  app.use(requestId);
  // Helmet sets secure defaults (X-Content-Type-Options, etc.). CSP is mostly
  // relevant when serving HTML; this API returns JSON only, so defaults are enough.
  app.use(helmet());
  app.use(
    cors({
      origin: config.cors.origins.includes('*') ? true : config.cors.origins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10kb' }));
  // Needed so authenticate() can read access_token / refresh_token cookies
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      customProps: (req) => ({
        requestId: req.id,
        route: req.route?.path,
      }),
      autoLogging: {
        ignore: (req) => {
          const p = req.url?.split('?')[0] || '';
          return (
            p === '/health/live' ||
            p === '/health/ready' ||
            p === '/health' ||
            p === '/metrics'
          );
        },
      },
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
          };
        },
      },
    }),
  );
  app.use(metricsMiddleware);

  // Liveness — process up only (orchestrators restart on failure)
  app.get('/health/live', (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        service: 'authentication-service',
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Alias for older docs / clients
  app.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        service: 'authentication-service',
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Readiness — safe to receive traffic only when deps are up
  app.get('/health/ready', async (_req, res) => {
    const [database, redis] = await Promise.all([pingDatabase(), pingRedis()]);
    const ready = database.ok && redis.ok;

    res.status(ready ? 200 : 503).json({
      success: ready,
      data: {
        status: ready ? 'ready' : 'not_ready',
        database,
        redis,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Prometheus scrape target (restrict at network / Nginx in production)
  app.get('/metrics', metricsHandler);

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
