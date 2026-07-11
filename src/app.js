const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { config } = require('./config');
const { apiRouter } = require('./routes');
const { notFoundHandler } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');

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

  app.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        service: 'authentication-service',
        env: config.env,
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
