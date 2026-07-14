const { query, withTransaction } = require('../../db');
const { AppError } = require('../../utils/AppError');

/**
 * Distinct permission keys for a user via user → roles → permissions.
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
async function getPermissionsForUser(userId) {
  const result = await query(
    `SELECT DISTINCT p.key
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = $1`,
    [userId],
  );
  return result.rows.map((row) => row.key);
}

/**
 * Role names for a user (DB source of truth).
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
async function getRolesForUser(userId) {
  const result = await query(
    `SELECT r.name
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY r.name`,
    [userId],
  );
  return result.rows.map((row) => row.name);
}

/**
 * Replace a user's roles with the given role names (admin action).
 * @param {string} userId
 * @param {string[]} roleNames
 * @returns {Promise<string[]>}
 */
async function setUserRoles(userId, roleNames) {
  if (!Array.isArray(roleNames) || roleNames.length === 0) {
    throw new AppError('At least one role is required', 400, 'VALIDATION_ERROR');
  }

  // Dedupe so ["admin","admin"] does not fail the length check below
  const uniqueNames = [...new Set(roleNames)];

  await withTransaction(async (client) => {
    const userResult = await client.query(
      `SELECT id FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    if (!userResult.rows[0]) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const rolesResult = await client.query(
      `SELECT id, name FROM roles WHERE name = ANY($1::text[])`,
      [uniqueNames],
    );

    if (rolesResult.rows.length !== uniqueNames.length) {
      throw new AppError('One or more roles are invalid', 400, 'VALIDATION_ERROR');
    }

    await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);

    for (const role of rolesResult.rows) {
      await client.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
        [userId, role.id],
      );
    }
  });

  return getRolesForUser(userId);
}

module.exports = {
  getPermissionsForUser,
  getRolesForUser,
  setUserRoles,
};
