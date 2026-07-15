const express = require('express');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/authenticate');
const {
  rateLimitLogin,
  rateLimitForgotPassword,
  rateLimitRegister,
  rateLimitResendVerification,
} = require('../../middleware/rateLimit');
const {
  registerBodySchema,
  verifyEmailBodySchema,
  resendVerificationBodySchema,
  loginBodySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
} = require('./auth.validation');
const authController = require('./auth.controller');

const router = express.Router();

// validate → rateLimit → controller (normalized email available for IP+email keys)
router.post(
  '/register',
  validate({ body: registerBodySchema }),
  rateLimitRegister(),
  authController.register,
);
router.post(
  '/verify-email',
  validate({ body: verifyEmailBodySchema }),
  authController.verifyEmail,
);
router.post(
  '/resend-verification',
  validate({ body: resendVerificationBodySchema }),
  rateLimitResendVerification(),
  authController.resendVerification,
);
router.post(
  '/login',
  validate({ body: loginBodySchema }),
  rateLimitLogin(),
  authController.login,
);

router.post('/refresh', authController.refresh);

router.post('/logout', authenticate, authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);

// IP-based: limiter before validate still counts junk/spam bodies
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
