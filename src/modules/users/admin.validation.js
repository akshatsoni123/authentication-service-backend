const { z } = require('zod');

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const updateRolesBodySchema = z.object({
  roles: z
    .array(z.enum(['user', 'moderator', 'admin']))
    .min(1, 'At least one role is required'),
});

const userIdParamsSchema = z.object({
  id: z.string().uuid('Invalid user id'),
});

module.exports = {
  listUsersQuerySchema,
  updateRolesBodySchema,
  userIdParamsSchema,
};
