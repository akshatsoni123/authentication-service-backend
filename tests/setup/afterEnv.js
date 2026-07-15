const { closePool } = require('../../src/db');
const { closeRedis } = require('../../src/redis');

/**
 * Soft silence pino in tests unless DEBUG_LOGS=1.
 * (Config/logger already loaded after setupFiles env.)
 */
if (process.env.DEBUG_LOGS !== '1') {
  try {
    const { logger } = require('../../src/utils/logger');
    logger.level = 'silent';
  } catch {
    // ignore if logger fails early
  }
}

afterAll(async () => {
  try {
    await closeRedis();
  } catch {
    // ignore
  }
  try {
    await closePool();
  } catch {
    // ignore
  }
});
