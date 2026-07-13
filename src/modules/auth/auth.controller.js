const authService = require('./auth.service');
const {
  COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
} = require('../../utils/cookies');

async function register(req, res, next) {
  try {
    const data = await authService.register(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const data = await authService.verifyEmail(req.body);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function resendVerification(req, res, next) {
  try {
    const data = await authService.resendVerification(req.body);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/login
 * Express calls this as login(req, res, next) — we don't pass args in routes.
 */
async function login(req, res, next) {
  try {
    const data = await authService.login(req.body, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Dual delivery: JSON Bearer + httpOnly cookies
    res.cookie(COOKIE.ACCESS, data.accessToken, accessCookieOptions());
    res.cookie(COOKIE.REFRESH, data.refreshToken, refreshCookieOptions());

    // Keep refresh out of JSON body (cookie-only)
    const { refreshToken: _refreshToken, ...body } = data;
    res.status(200).json({ success: true, data: body });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/refresh — reads refresh_token cookie, rotates session, sets new cookies.
 */
async function refresh(req, res, next) {
  try {
    const rawRefresh = req.cookies?.[COOKIE.REFRESH];
    const data = await authService.refresh(rawRefresh, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.cookie(COOKIE.ACCESS, data.accessToken, accessCookieOptions());
    res.cookie(COOKIE.REFRESH, data.refreshToken, refreshCookieOptions());

    const { refreshToken: _refreshToken, ...body } = data;
    res.status(200).json({ success: true, data: body });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/logout — needs authenticate so we know access jti for denylist.
 */
async function logout(req, res, next) {
  try {
    const rawRefresh = req.cookies?.[COOKIE.REFRESH];
    const data = await authService.logout({
      rawRefresh,
      accessJti: req.user?.jti,
      accessExp: req.user?.exp,
    });

    // Clear both cookies on the client
    res.clearCookie(COOKIE.ACCESS, { path: '/' });
    res.clearCookie(COOKIE.REFRESH, { path: '/api/v1/auth' });

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/logout-all — wipe every Redis refresh session for this user.
 */
async function logoutAll(req, res, next) {
  try {
    const data = await authService.logoutAll(req.user.id);

    res.clearCookie(COOKIE.ACCESS, { path: '/' });
    res.clearCookie(COOKIE.REFRESH, { path: '/api/v1/auth' });

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  refresh,
  logout,
  logoutAll,
};
