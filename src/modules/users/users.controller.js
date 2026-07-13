const { AppError } = require('../../utils/AppError');
const { findUserProfileById } = require('../auth/auth.repository');

/**
 * GET /users/me — uses req.user set by authenticate middleware
 */
async function me(req, res, next) {
  try {
    const user = await findUserProfileById(req.user.id);
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }
    res.status(200).json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
}

module.exports = { me };
