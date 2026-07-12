const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Knex CLI config.
 * Why Knex + pg (not Prisma): explicit SQL/migrations, easy EXPLAIN, full control
 * over indexes/constraints — better for learning production Postgres patterns.
 */
const shared = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: {
    min: 0,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_MS || 30000),
  },
  migrations: {
    directory: path.resolve(__dirname, 'src/db/migrations'),
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: path.resolve(__dirname, 'src/db/seeds'),
  },
};

module.exports = {
  development: { ...shared },
  test: { ...shared },
  production: { ...shared },
};
