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

/**
 * @param {string} tokenHash
 */
async function findVerificationTokenByHash(tokenHash) {
  const result = await query(
    `SELECT t.id, t.user_id, t.expires_at, t.used_at, u.is_email_verified
     FROM email_verification_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = $1
     LIMIT 1`,
    [tokenHash],
  );
  return result.rows[0] ?? null;
}

/**
 * Mark user verified and consume the token in one transaction.
 * @param {string} userId
 * @param {string} tokenId
 */
async function markEmailVerified(userId, tokenId) {
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE users SET is_email_verified = true, updated_at = NOW() WHERE id = $1`,
      [userId],
    );
    await client.query(
      `UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1 AND used_at IS NULL`,
      [tokenId],
    );
  });
}

/**
 * @param {string} email
 */
async function findUserByEmail(email) {
  const result = await query(
    `SELECT id, email, is_email_verified FROM users WHERE email = $1 LIMIT 1`,
    [email],
  );
  return result.rows[0] ?? null;
}

/**
 * Invalidate previous unused tokens, then insert a new hashed token.
 * @param {{ userId: string, tokenHash: string, expiresAt: Date }} input
 */
async function createVerificationToken({ userId, tokenHash, expiresAt }) {
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE email_verification_tokens
       SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );
    await client.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
  });
}

/**
 * Load user + role names for login (includes password_hash for bcrypt.compare).
 * @param {string} email
 */
async function findUserWithRolesByEmail(email) {
  const userResult = await query(
    `SELECT id, email, password_hash, is_email_verified, status
     FROM users WHERE email = $1 LIMIT 1`,
    [email],
  );
  const user = userResult.rows[0];
  if (!user) return null;

  const rolesResult = await query(
    `SELECT r.name
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [user.id],
  );

  return { ...user, roles: rolesResult.rows.map((row) => row.name) };
}

/**
 * Safe profile for GET /users/me (no password_hash).
 * @param {string} userId
 */
async function findUserProfileById(userId) {
  const userResult = await query(
    `SELECT id, email, is_email_verified, status, created_at
     FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const user = userResult.rows[0];
  if (!user) return null;

  const rolesResult = await query(
    `SELECT r.name
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId],
  );

  return {
    id: user.id,
    email: user.email,
    isEmailVerified: user.is_email_verified,
    status: user.status,
    roles: rolesResult.rows.map((row) => row.name),
    createdAt: user.created_at,
  };
}

module.exports = {
  createUserWithDefaults,
  findRoleIdByName,
  findVerificationTokenByHash,
  markEmailVerified,
  findUserByEmail,
  createVerificationToken,
  findUserWithRolesByEmail,
  findUserProfileById,
};
