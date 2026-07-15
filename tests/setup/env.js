const path = require('path');
const dotenv = require('dotenv');

/**
 * Must run before any `require('../../src/...')` that loads config.
 * Jest `setupFiles` runs in the same process as tests.
 */
const envPath = path.resolve(__dirname, '../../.env.test');
const result = dotenv.config({ path: envPath });

if (result.error && process.env.CI !== 'true') {
  // Allow CI to inject env vars without a file; local runs should copy .env.test.example
  console.warn(
    `[jest] could not load ${envPath} — ensure .env.test exists (copy from .env.test.example)`,
  );
}

process.env.NODE_ENV = 'test';
