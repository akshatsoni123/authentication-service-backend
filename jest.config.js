/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // Load .env.test before any src/config require
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/afterEnv.js'],
  globalSetup: '<rootDir>/tests/setup/globalSetup.js',
  globalTeardown: '<rootDir>/tests/setup/globalTeardown.js',
  // Meaningful coverage on auth stack; not vanity 100%
  collectCoverageFrom: [
    'src/modules/auth/**/*.js',
    'src/middleware/{authenticate,authorize,rateLimit,validate}.js',
    'src/utils/{password,jwt,tokens,cookies}.js',
    'src/services/{session,email}.service.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  // bcrypt + real DB/Redis need room
  testTimeout: 30000,
  // Prefer sequential for shared Redis rate-limit keys; still fast enough
  maxWorkers: 1,
  verbose: true,
  clearMocks: true,
};
