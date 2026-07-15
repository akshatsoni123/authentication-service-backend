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

function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Behind Nginx / a load balancer in production, trust X-Forwarded-For so
  // req.ip (and thus rate-limit keys) reflect the real client, not the proxy.
  if (config.isProd) {
    app.set('trust proxy', 1);
  }

  // Order: requestId → helmet → cors → json → cookies → http logger → routes → 404 → errors
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
      customProps: (req) => ({ requestId: req.id }),
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

  app.get('/health', async (_req, res) => {
    const redis = await pingRedis();
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        service: 'authentication-service',
        env: config.env,
        redis: { ok: redis.ok, status: redis.status, reason: redis.reason },
        timestamp: new Date().toISOString(),
      },
    });
  });

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

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
