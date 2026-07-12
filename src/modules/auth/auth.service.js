const { AppError } = require('../../utils/AppError');
const { hashPassword } = require('../../utils/password');
const { generateOpaqueToken, hashToken } = require('../../utils/tokens');
const { createUserWithDefaults } = require('./auth.repository');
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
    // Postgres unique_violation (email already taken — including race)
    if (err && err.code === '23505') {
      throw new AppError('Email already registered', 409, 'CONFLICT');
    }
    throw err;
  }

  // Stub email delivery — Issue #07 will send via SMTP
  logger.info(
    { email, userId: created.user.id },
    'verification email stubbed (Issue #07 will send SMTP)',
  );
  if (config.isDev) {
    logger.debug({ emailVerificationToken: rawToken }, 'dev-only verify token');
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

module.exports = { register };
