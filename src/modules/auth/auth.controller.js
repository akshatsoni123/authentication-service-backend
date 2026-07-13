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
    // req.body = { email, password } (already validated by Zod middleware)
    // meta = optional audit info from the HTTP request
    const data = await authService.login(req.body, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Dual delivery:
    // 1) JSON accessToken for Authorization: Bearer (Postman)
    // 2) httpOnly cookies for browser-style clients
    res.cookie(COOKIE.ACCESS, data.accessToken, accessCookieOptions());
    res.cookie(COOKIE.REFRESH, data.refreshStub, refreshCookieOptions());

    // Do not put refreshStub in the JSON body (cookie-only for refresh)
    const { refreshStub: _refreshStub, ...body } = data;
    res.status(200).json({ success: true, data: body });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, verifyEmail, resendVerification, login };
