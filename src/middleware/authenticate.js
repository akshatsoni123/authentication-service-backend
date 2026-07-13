const { AppError } = require('../utils/AppError');
const { verifyAccessToken } = require('../utils/jwt');
const { COOKIE } = require('../utils/cookies');

/**
 * Protect routes: require a valid access JWT.
 *
 * Accepts either:
 *  1) Authorization: Bearer <token>   ← best for Postman / mobile
 *  2) access_token httpOnly cookie    ← handy for browsers
 *
 * On success, sets req.user = { id, roles, jti }
 */
function authenticate(req, _res, next) {
  try {
    let token;

    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      // "Bearer eyJhbGciOi..." → take the part after "Bearer "
      token = header.slice('Bearer '.length).trim();
    } else if (req.cookies && req.cookies[COOKIE.ACCESS]) {
      token = req.cookies[COOKIE.ACCESS];
    }

    if (!token) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const payload = verifyAccessToken(token);

    // Controllers should use req.user.id — never trust a userId from the body
    req.user = {
      id: payload.sub,
      roles: payload.roles || [],
      jti: payload.jti,
    };

    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid or expired access token', 401, 'UNAUTHORIZED'));
    }
    return next(err);
  }
}

module.exports = { authenticate };
