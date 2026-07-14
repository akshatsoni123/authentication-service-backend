const { AppError } = require('../../utils/AppError');
const usersService = require('./users.service');
const rolesService = require('../roles/roles.service');

/**
 * GET /admin/users
 */
async function listUsers(req, res, next) {
  try {
    const { page, limit } = req.query;
    const data = await usersService.listUsers({ page, limit });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /admin/users/:id/roles
 * Body: { "roles": ["user", "admin"] }
 */
async function updateUserRoles(req, res, next) {
  try {
    const { id } = req.params;
    const { roles } = req.body;

    if (!Array.isArray(roles) || roles.length === 0) {
      throw new AppError('roles must be a non-empty array', 400, 'VALIDATION_ERROR');
    }

    const updatedRoles = await rolesService.setUserRoles(id, roles);

    res.status(200).json({
      success: true,
      data: {
        userId: id,
        roles: updatedRoles,
        note: 'Role changes take effect on next login/refresh (new access token).',
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, updateUserRoles };
