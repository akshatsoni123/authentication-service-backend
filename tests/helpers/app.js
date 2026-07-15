const { createApp } = require('../../src/app');
const { connectRedis } = require('../../src/redis');

/** @type {import('express').Express | null} */
let app = null;

/**
 * Shared Express app for Supertest (no listen). Connects Redis once.
 */
async function getTestApp() {
  if (!app) {
    await connectRedis();
    app = createApp();
  }
  return app;
}

module.exports = { getTestApp };
