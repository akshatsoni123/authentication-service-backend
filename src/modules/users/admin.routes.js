const express = require('express');
const { authenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const { validate } = require('../../middleware/validate');
const adminController = require('./admin.controller');
const {
  listUsersQuerySchema,
  updateRolesBodySchema,
  userIdParamsSchema,
} = require('./admin.validation');

const router = express.Router();

// authenticate → identify user; authorize('admin') → 403 if not admin
router.get(
  '/users',
  authenticate,
  authorize('admin'),
  validate({ query: listUsersQuerySchema }),
  adminController.listUsers,
);

router.patch(
  '/users/:id/roles',
  authenticate,
  authorize('admin'),
  validate({ params: userIdParamsSchema, body: updateRolesBodySchema }),
  adminController.updateUserRoles,
);

module.exports = { adminRouter: router };
