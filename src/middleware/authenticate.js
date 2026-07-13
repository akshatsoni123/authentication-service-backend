const { AppError } = require('../utils/AppError');
const { verifyAccessToken } = require('../utils/jwt');
const { COOKIE } = require('../utils/cookies');
const { isAccessJtiDenied } = require('../services/session.service');

/**
 * Protect routes: require a valid access JWT.
 *
 * Accepts either:
 *  1) Authorization: Bearer <token>   ← best for Postman / mobile
 *  2) access_token httpOnly cookie    ← handy for browsers
 *
 * On success, sets req.user = { id, roles, jti, exp }
 */
async function authenticate(req, _res, next) {
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

    // After logout, jti lives on a Redis denylist until natural exp
    if (await isAccessJtiDenied(payload.jti)) {
      throw new AppError('Invalid or expired access token', 401, 'UNAUTHORIZED');
    }

    // Controllers should use req.user.id — never trust a userId from the body
    req.user = {
      id: payload.sub,
      roles: payload.roles || [],
      jti: payload.jti,
      exp: payload.exp, // unix seconds — used to compute denylist TTL on logout
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
