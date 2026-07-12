const { withTransaction, query } = require('../../db');

/**
 * @param {string} name
 * @param {import('pg').PoolClient | null} [client]
 */
async function findRoleIdByName(name, client = null) {
  const run = client ? client.query.bind(client) : query;
  const result = await run(`SELECT id FROM roles WHERE name = $1 LIMIT 1`, [name]);
  return result.rows[0]?.id ?? null;
}

/**
 * Atomically create user + default "user" role + email verification token.
 * Uses parameterized SQL to prevent injection.
 *
 * @param {{ email: string, passwordHash: string, tokenHash: string, expiresAt: Date }} input
 */
async function createUserWithDefaults({ email, passwordHash, tokenHash, expiresAt }) {
  return withTransaction(async (client) => {
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, is_email_verified, status)
       VALUES ($1, $2, false, 'active')
       RETURNING id, email, is_email_verified, status, created_at`,
      [email, passwordHash],
    );
    const user = userResult.rows[0];

    const roleId = await findRoleIdByName('user', client);
    if (!roleId) {
      throw new Error('Default role "user" missing — run npm run seed');
    }

    await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [
      user.id,
      roleId,
    ]);

    await client.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt],
    );

    return { user, roles: ['user'] };
  });
}

module.exports = { createUserWithDefaults, findRoleIdByName };
