const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { config } = require('./config');
const { apiRouter } = require('./routes');
const { notFoundHandler } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');
const { pingDatabase } = require('./db');
const { pingRedis } = require('./redis');

function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Middleware order (see docs/ARCHITECTURE.md): security → parsers → routes → errors
  app.use(helmet());
  app.use(
    cors({
      origin: config.cors.origins.includes('*') ? true : config.cors.origins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10kb' }));

  /** Liveness-style: process is up (always 200 if we can answer) */
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

  /** Readiness: Postgres + Redis must respond */
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
