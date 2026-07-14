const { query } = require('../../db');

/**
 * Paginated user list for admin routes.
 * @param {{ page?: number, limit?: number }} [opts]
 */
async function listUsers({ page = 1, limit = 20 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (safePage - 1) * safeLimit;

  const countResult = await query(`SELECT COUNT(*)::int AS total FROM users`);
  const total = countResult.rows[0].total;

  const result = await query(
    `SELECT
       u.id,
       u.email,
       u.is_email_verified,
       u.status,
       u.created_at,
       COALESCE(
         array_agg(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL),
         '{}'
       ) AS roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT $1 OFFSET $2`,
    [safeLimit, offset],
  );

  return {
    users: result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      isEmailVerified: row.is_email_verified,
      status: row.status,
      roles: row.roles,
      createdAt: row.created_at,
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
    },
  };
}

module.exports = { listUsers };
