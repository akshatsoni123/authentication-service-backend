const path = require('path');
const { Client } = require('pg');
const knexFactory = require('knex');
const dotenv = require('dotenv');

/**
 * Jest globalSetup (separate process): create test DB if needed, migrate + seed.
 */
module.exports = async function globalSetup() {
  const envPath = path.resolve(__dirname, '../../.env.test');
  dotenv.config({ path: envPath });
  process.env.NODE_ENV = 'test';

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL missing — copy .env.test.example → .env.test');
  }

  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace(/^\//, '');
  if (!dbName) {
    throw new Error('DATABASE_URL must include a database name');
  }

  // Connect to maintenance DB to CREATE DATABASE if missing
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rowCount === 0) {
      // Identifier cannot be parameterized; dbName comes from our .env.test only
      await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
      // eslint-disable-next-line no-console
      console.log(`[jest globalSetup] created database ${dbName}`);
    }
  } finally {
    await admin.end();
  }

  const knex = knexFactory({
    client: 'pg',
    connection: databaseUrl,
    migrations: {
      directory: path.resolve(__dirname, '../../src/db/migrations'),
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: path.resolve(__dirname, '../../src/db/seeds'),
    },
  });

  try {
    await knex.migrate.latest();
    await knex.seed.run();
    // eslint-disable-next-line no-console
    console.log('[jest globalSetup] migrate + seed complete');
  } finally {
    await knex.destroy();
  }
};
