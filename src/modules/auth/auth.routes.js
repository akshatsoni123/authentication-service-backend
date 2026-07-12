const express = require('express');
const { validate } = require('../../middleware/validate');
const {
  registerBodySchema,
  verifyEmailBodySchema,
  resendVerificationBodySchema,
} = require('./auth.validation');
const authController = require('./auth.controller');

const router = express.Router();

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

module.exports = { authRouter: router };
