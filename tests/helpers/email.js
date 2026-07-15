const emailService = require('../../src/services/email.service');

/** @type {{ verify: string | null, reset: string | null }} */
const captured = { verify: null, reset: null };

/**
 * Spy email sends so API tests can read opaque tokens without SMTP.
 * Uses module.exports so spies apply even when auth.service holds the namespace.
 */
function installEmailCapture() {
  captured.verify = null;
  captured.reset = null;

  jest.spyOn(emailService, 'sendVerificationEmail').mockImplementation(async ({ rawToken }) => {
    captured.verify = rawToken;
    return { sent: true, previewUrl: null, messageId: 'test-verify' };
  });

  jest.spyOn(emailService, 'sendPasswordResetEmail').mockImplementation(async ({ rawToken }) => {
    captured.reset = rawToken;
    return { sent: true, previewUrl: null, messageId: 'test-reset' };
  });

  return captured;
}

function getCapturedVerifyToken() {
  if (!captured.verify) {
    throw new Error('No verification token captured — did register/resend run with email spy?');
  }
  return captured.verify;
}

function getCapturedResetToken() {
  if (!captured.reset) {
    throw new Error('No reset token captured — did forgot-password run with email spy?');
  }
  return captured.reset;
}

module.exports = {
  installEmailCapture,
  getCapturedVerifyToken,
  getCapturedResetToken,
  captured,
};
