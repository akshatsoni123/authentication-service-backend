/**
 * Jest globalTeardown — reserved for future cleanup.
 * Per-process pools are closed in afterEnv afterAll / helpers.
 */
module.exports = async function globalTeardown() {
  // no-op: workers close Redis/pg in afterAll
};
