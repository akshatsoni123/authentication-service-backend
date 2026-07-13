const express = require('express');
const { validate } = require('../../middleware/validate');
const {
  registerBodySchema,
  verifyEmailBodySchema,
  resendVerificationBodySchema,
  loginBodySchema,
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

module.exports = { authRouter: router };
