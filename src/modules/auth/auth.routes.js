const express = require('express');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/authenticate');
const { rateLimitForgotPassword } = require('../../middleware/rateLimit');
const {
  registerBodySchema,
  verifyEmailBodySchema,
  resendVerificationBodySchema,
  loginBodySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
} = require('./auth.validation');
// authController = object of handler functions from auth.controller.js
const authController = require('./auth.controller');

const router = express.Router();

// Pattern: validate first, then controller. Express injects (req, res, next).
router.post('/register', validate({ body: registerBodySchema }), authController.register);
router.post(
  '/verify-email',
  validate({ body: verifyEmailBodySchema }),
  authController.verifyEmail,
);
router.post(
  '/resend-verification',
  validate({ body: resendVerificationBodySchema }),
  authController.resendVerification,
);
router.post('/login', validate({ body: loginBodySchema }), authController.login);

// Refresh uses cookie only — no body schema required
router.post('/refresh', authController.refresh);

// Logout needs access token so we can denylist its jti
router.post('/logout', authenticate, authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);

// Password reset (Issue #10)
router.post(
  '/forgot-password',
  rateLimitForgotPassword(),
  validate({ body: forgotPasswordBodySchema }),
  authController.forgotPassword,
);
router.post(
  '/reset-password',
  validate({ body: resetPasswordBodySchema }),
  authController.resetPassword,
);

module.exports = { authRouter: router };
