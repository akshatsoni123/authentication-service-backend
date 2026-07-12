const path = require('path');
const dotenv = require('dotenv');

// Load .env before any config import so validation sees process.env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { config } = require('./config');
const { createApp } = require('./app');
const { closePool } = require('./db');
const { connectRedis, closeRedis } = require('./redis');

const app = createApp();

async function start() {
  await connectRedis();

  const server = app.listen(config.port, () => {
    console.log(
      `[server] authentication-service listening on port ${config.port} (${config.env})`,
    );
  });

  function shutdown(signal) {
    console.log(`[server] received ${signal}, shutting down`);
    server.close(async () => {
      try {
        await closeRedis();
      } catch (err) {
        console.error('[server] error closing redis', err);
      }
      try {
        await closePool();
      } catch (err) {
        console.error('[server] error closing db pool', err);
      }
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('uncaughtException', (err) => {
    console.error('[server] uncaughtException', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[server] unhandledRejection', reason);
    process.exit(1);
  });

  return server;
}

const serverPromise = start();

module.exports = { app, serverPromise };
