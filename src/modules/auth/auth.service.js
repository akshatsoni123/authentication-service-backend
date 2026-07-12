const { AppError } = require('../../utils/AppError');
const { hashPassword } = require('../../utils/password');
const { generateOpaqueToken, hashToken } = require('../../utils/tokens');
const {
  createUserWithDefaults,
  findVerificationTokenByHash,
  markEmailVerified,
  findUserByEmail,
  createVerificationToken,
} = require('./auth.repository');
const { sendVerificationEmail } = require('../../services/email.service');
const { logger } = require('../../utils/logger');
const { config } = require('../../config');

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Register a new user. Never returns password_hash.
 * @param {{ email: string, password: string }} input
 */
async function register({ email, password }) {
  const passwordHash = await hashPassword(password);
  const rawToken = generateOpaqueToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + VERIFY_TTL_MS);

  let created;
  try {
    created = await createUserWithDefaults({
      email,
      passwordHash,
      tokenHash,
      expiresAt,
    });
  } catch (err) {
    if (err && err.code === '23505') {
      throw new AppError('Email already registered', 409, 'CONFLICT');
    }
    throw err;
  }

  const mail = await sendVerificationEmail({ to: email, rawToken });
  if (config.isDev) {
    logger.debug(
      {
        emailVerificationToken: rawToken,
        previewUrl: mail.previewUrl || undefined,
        sent: mail.sent,
      },
      'dev-only verification token (also in email if SMTP/Ethereal worked)',
    );
  }

  return {
    user: {
      id: created.user.id,
      email: created.user.email,
      isEmailVerified: created.user.is_email_verified,
      roles: created.roles,
      createdAt: created.user.created_at,
    },
    message: 'Registration successful. Please verify your email.',
  };
}

/**
 * Verify email with raw token from email.
 * Idempotent: first success and later repeats with same used token → 200.
 * @param {{ token: string }} input
 */
async function verifyEmail({ token }) {
  const tokenHash = hashToken(token);
  const row = await findVerificationTokenByHash(tokenHash);

  if (!row) {
    throw new AppError('Invalid verification token', 400, 'VALIDATION_ERROR');
  }

  // Idempotent success path (already consumed)
  if (row.used_at) {
    return { message: 'Email already verified.' };
  }

  if (new Date(row.expires_at) < new Date()) {
    throw new AppError('Verification token expired', 400, 'VALIDATION_ERROR');
  }

  await markEmailVerified(row.user_id, row.id);
  return { message: 'Email verified successfully.' };
}

/**
 * Resend verification. Generic response (anti-enumeration).
 * Rate limiting: Issue #12.
 * @param {{ email: string }} input
 */
async function resendVerification({ email }) {
  const generic = {
    message: 'If an account exists and is unverified, a new email has been sent.',
  };

  const user = await findUserByEmail(email);
  if (!user || user.is_email_verified) {
    return generic;
  }

  const rawToken = generateOpaqueToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + VERIFY_TTL_MS);

  await createVerificationToken({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const mail = await sendVerificationEmail({ to: email, rawToken });
  if (config.isDev) {
    logger.debug(
      {
        email,
        emailVerificationToken: rawToken,
        previewUrl: mail.previewUrl || undefined,
      },
      'dev-only resend verification token',
    );
  }

  return generic;
}

module.exports = { register, verifyEmail, resendVerification };
