const path = require('path');
const dotenv = require('dotenv');

// Load .env before any config import so validation sees process.env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { config } = require('./config');
const { createApp } = require('./app');

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(
    `[server] authentication-service listening on port ${config.port} (${config.env})`,
  );
});

function shutdown(signal) {
  console.log(`[server] received ${signal}, shutting down`);
  server.close(() => {
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

module.exports = { app, server };
