/**
 * Seed default roles + permissions for RBAC learning.
 * Idempotent: safe to re-run (skips if role/permission already exists).
 *
 * @param {import('knex').Knex} knex
 */
exports.seed = async function seed(knex) {
  const roles = [
    { name: 'user', description: 'Default authenticated user' },
    { name: 'moderator', description: 'Limited administrative privileges' },
    { name: 'admin', description: 'Full administrative access' },
  ];

  const permissions = [
    { key: 'users:read', description: 'Read user profiles' },
    { key: 'users:write', description: 'Update user profiles' },
    { key: 'users:list', description: 'List all users (admin)' },
    { key: 'roles:assign', description: 'Assign roles to users' },
  ];

  for (const role of roles) {
    const existing = await knex('roles').where({ name: role.name }).first();
    if (!existing) {
      await knex('roles').insert(role);
    }
  }

  for (const permission of permissions) {
    const existing = await knex('permissions').where({ key: permission.key }).first();
    if (!existing) {
      await knex('permissions').insert(permission);
    }
  }

  const roleRows = await knex('roles').select('id', 'name');
  const permissionRows = await knex('permissions').select('id', 'key');

  const byRole = Object.fromEntries(roleRows.map((r) => [r.name, r.id]));
  const byPerm = Object.fromEntries(permissionRows.map((p) => [p.key, p.id]));

  /** @type {Record<string, string[]>} */
  const rolePermissionMap = {
    user: ['users:read'],
    moderator: ['users:read', 'users:list'],
    admin: ['users:read', 'users:write', 'users:list', 'roles:assign'],
  };

  for (const [roleName, keys] of Object.entries(rolePermissionMap)) {
    const roleId = byRole[roleName];
    for (const key of keys) {
      const permissionId = byPerm[key];
      if (!roleId || !permissionId) continue;

      const exists = await knex('role_permissions')
        .where({ role_id: roleId, permission_id: permissionId })
        .first();

      if (!exists) {
        await knex('role_permissions').insert({
          role_id: roleId,
          permission_id: permissionId,
        });
      }
    }
  }
};
