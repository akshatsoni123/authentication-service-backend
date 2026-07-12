const { Pool } = require('pg');
const { config } = require('../config');

/** @type {import('pg').Pool | null} */
let pool = null;

/**
 * Shared connection pool — one Pool for the process, not a Client per request.
 */
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      max: config.database.pool.max,
      idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
      connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
    });

    pool.on('error', (err) => {
      console.error('[db] unexpected pool error', err);
    });
  }

  return pool;
}

function getDatabaseConfig() {
  return {
    connectionString: config.database.url,
    pool: config.database.pool,
  };
}

/**
 * @param {string} text
 * @param {unknown[]} [params]
 */
async function query(text, params = []) {
  return getPool().query(text, params);
}

/**
 * Run multiple statements in a single ACID transaction.
 * Use for multi-step writes (e.g. create user + role + verify token).
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function pingDatabase() {
  try {
    const result = await query('SELECT 1 AS ok');
    return { ok: result.rows[0]?.ok === 1 };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'database_unreachable',
    };
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  getDatabaseConfig,
  query,
  withTransaction,
  pingDatabase,
  closePool,
};
