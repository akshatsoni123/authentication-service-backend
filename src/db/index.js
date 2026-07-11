/**
 * PostgreSQL connection pool — wired in Issue #03.
 * Keep imports pointing here so modules do not create ad-hoc clients.
 */
const { config } = require('../config');

function getDatabaseConfig() {
  return {
    connectionString: config.database.url,
  };
}

async function pingDatabase() {
  // Placeholder until the pool is implemented
  return { ok: false, reason: 'database_not_connected_yet' };
}

module.exports = {
  getDatabaseConfig,
  pingDatabase,
};
