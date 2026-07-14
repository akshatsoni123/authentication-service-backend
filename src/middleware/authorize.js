const { AppError } = require('../utils/AppError');

/**
 * Role gate — user must have at least one of the listed roles.
 *
 * Always mount after `authenticate` so `req.user` exists:
 *   router.get('/admin/users', authenticate, authorize('admin'), handler);
 *
 * Uses JWT-embedded roles (fast). Role changes apply after the next access token
 * is issued (login/refresh) — see docs/RBAC.md for the JWT vs DB trade-off.
 *
 * @param {...string} allowedRoles
 */
function authorize(...allowedRoles) {
  return function authorizeMiddleware(req, _res, next) {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    const userRoles = req.user.roles || [];
    const allowed = allowedRoles.some((role) => userRoles.includes(role));

    if (!allowed) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }

    return next();
  };
}

/**
 * Permission gate — loads permissions from Postgres (source of truth).
 *
 * Slower than `authorize` but reflects role/permission changes immediately
 * without waiting for the access JWT to expire.
 *
 * @param {string} permissionKey  e.g. 'users:list' | 'roles:assign'
 */
function requirePermission(permissionKey) {
  return async function requirePermissionMiddleware(req, _res, next) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const rolesService = require('../modules/roles/roles.service');
      const permissions = await rolesService.getPermissionsForUser(req.user.id);

      if (!permissions.includes(permissionKey)) {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
      }

      req.user.permissions = permissions;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { authorize, requirePermission };
