const crypto = require('crypto');
const { AppError } = require('../../utils/AppError');
const { hashPassword, verifyPassword } = require('../../utils/password');
const { generateOpaqueToken, hashToken } = require('../../utils/tokens');
const { signAccessToken } = require('../../utils/jwt');
const {
  createUserWithDefaults,
  findVerificationTokenByHash,
  markEmailVerified,
  findUserByEmail,
  createVerificationToken,
  findUserWithRolesByEmail,
  findUserProfileById,
  findActiveUserByEmail,
  createPasswordResetToken,
  findPasswordResetTokenByHash,
  resetPasswordWithToken,
} = require('./auth.repository');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require('../../services/email.service');
const {
  createRefreshSession,
  findRefreshSession,
  findRefreshReuseTombstone,
  destroyRefreshSession,
  revokeFamily,
  denyAccessJti,
  revokeAllUserSessions,
} = require('../../services/session.service');
const { logger } = require('../../utils/logger');
const { config } = require('../../config');
const { observeLoginSuccess, observeLoginFailure } = require('../../metrics');

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

const GENERIC_FORGOT = {
  message: 'If an account exists for that email, a reset link has been sent.',
};

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

/**
 * Login with email + password.
 * Issues short-lived access JWT + Redis-backed refresh session (Issue #09).
 *
 * @param {{ email: string, password: string }} input
 * @param {{ ip?: string, userAgent?: string }} [meta]
 */
async function login({ email, password }, meta = {}) {
  const user = await findUserWithRolesByEmail(email);

  // Same message for "no user" and "wrong password"
  const invalid = () => new AppError('Invalid email or password', 401, 'UNAUTHORIZED');

  if (!user || user.status !== 'active') {
    // No email / password in logs — reason code only
    logger.info(
      { event: 'login_failed', reason: 'invalid_credentials', ip: meta.ip },
      'login failed',
    );
    observeLoginFailure('invalid_credentials');
    throw invalid();
  }

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) {
    logger.info(
      {
        event: 'login_failed',
        reason: 'invalid_credentials',
        userId: user.id,
        ip: meta.ip,
      },
      'login failed',
    );
    observeLoginFailure('invalid_credentials');
    throw invalid();
  }

  const { token, jti, expiresIn } = signAccessToken({
    userId: user.id,
    roles: user.roles,
  });

  // One familyId per login — all rotated refresh tokens share it for reuse detection
  const familyId = crypto.randomUUID();
  const session = await createRefreshSession({
    userId: user.id,
    familyId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  logger.info(
    {
      event: 'login_success',
      userId: user.id,
      jti,
      familyId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
    'user logged in',
  );
  observeLoginSuccess();

  return {
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn,
    // Controller sets httpOnly cookie; not returned in JSON body
    refreshToken: session.rawRefresh,
    user: {
      id: user.id,
      email: user.email,
      isEmailVerified: user.is_email_verified,
      roles: user.roles,
    },
  };
}

/**
 * Rotate refresh token and issue a new access JWT.
 *
 * Flow:
 * 1) Lookup session by hashed cookie value
 * 2) If missing but tombstone exists → reuse/theft → revoke family → 401
 * 3) Destroy old session (write tombstone)
 * 4) Issue new access + new refresh (same familyId)
 *
 * @param {string} rawRefresh
 * @param {{ ip?: string, userAgent?: string }} [meta]
 */
async function refresh(rawRefresh, meta = {}) {
  if (!rawRefresh) {
    throw new AppError('Refresh token required', 401, 'UNAUTHORIZED');
  }

  const session = await findRefreshSession(rawRefresh);

  if (!session) {
    // Old cookie presented after rotation → likely theft
    const tombstone = await findRefreshReuseTombstone(rawRefresh);
    if (tombstone) {
      await revokeFamily(tombstone.userId, tombstone.familyId);
      logger.warn(
        { userId: tombstone.userId, familyId: tombstone.familyId },
        'refresh token reuse detected — family revoked',
      );
      throw new AppError('Refresh token reuse detected', 401, 'UNAUTHORIZED');
    }
    throw new AppError('Invalid or expired refresh token', 401, 'UNAUTHORIZED');
  }

  // Rotate: kill old session BEFORE issuing the new one
  await destroyRefreshSession({
    userId: session.userId,
    tokenId: session.tokenId,
    tokenHash: session.tokenHash,
    familyId: session.familyId,
    writeTombstone: true,
  });

  const profile = await findUserProfileById(session.userId);
  if (!profile || profile.status !== 'active') {
    throw new AppError('Invalid or expired refresh token', 401, 'UNAUTHORIZED');
  }

  const { token, expiresIn } = signAccessToken({
    userId: profile.id,
    roles: profile.roles,
  });

  // Same familyId so a later reuse of ANY old token in this lineage can wipe all
  const next = await createRefreshSession({
    userId: profile.id,
    familyId: session.familyId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  logger.info({ userId: profile.id, familyId: session.familyId }, 'refresh rotated');

  return {
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn,
    refreshToken: next.rawRefresh,
  };
}

/**
 * Logout current session: delete refresh + denylist access jti until exp.
 * @param {{ rawRefresh?: string, accessJti?: string, accessExp?: number }} input
 */
async function logout({ rawRefresh, accessJti, accessExp }) {
  if (rawRefresh) {
    const session = await findRefreshSession(rawRefresh);
    if (session) {
      await destroyRefreshSession({
        userId: session.userId,
        tokenId: session.tokenId,
        tokenHash: session.tokenHash,
        familyId: session.familyId,
        writeTombstone: false,
      });
    }
  }

  // Block the current access JWT until it would have expired naturally
  if (accessJti && accessExp) {
    const ttl = accessExp - Math.floor(Date.now() / 1000);
    await denyAccessJti(accessJti, ttl);
  }

  return { message: 'Logged out successfully.' };
}

/**
 * Wipe all Redis refresh sessions for this user (remote logout everywhere).
 * @param {string} userId
 */
async function logoutAll(userId) {
  await revokeAllUserSessions(userId);
  return { message: 'Logged out from all sessions.' };
}

/**
 * Forgot password — anti-enumeration: always the same 200 message.
 * @param {{ email: string }} input
 */
async function forgotPassword({ email }) {
  const user = await findActiveUserByEmail(email);

  if (user && user.status === 'active') {
    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);

    await createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const mail = await sendPasswordResetEmail({ to: email, rawToken });
    if (config.isDev) {
      logger.debug(
        {
          email,
          passwordResetToken: rawToken,
          previewUrl: mail.previewUrl || undefined,
          sent: mail.sent,
        },
        'dev-only password reset token',
      );
    }
  }

  return GENERIC_FORGOT;
}

/**
 * Reset password with opaque token from email.
 * Updates bcrypt hash, consumes token, revokes all Redis sessions.
 * @param {{ token: string, newPassword: string }} input
 */
async function resetPassword({ token, newPassword }) {
  const tokenHash = hashToken(token);
  const row = await findPasswordResetTokenByHash(tokenHash);

  // Same opaque error for missing / used / expired / inactive — less oracle for attackers
  const invalid = () =>
    new AppError('Invalid or expired reset token', 400, 'VALIDATION_ERROR');

  if (!row || row.used_at || row.status !== 'active') {
    throw invalid();
  }
  if (new Date(row.expires_at) < new Date()) {
    throw invalid();
  }

  const passwordHash = await hashPassword(newPassword);

  await resetPasswordWithToken({
    userId: row.user_id,
    tokenId: row.id,
    passwordHash,
  });

  // Password changed → every old refresh cookie must die
  try {
    await revokeAllUserSessions(row.user_id);
  } catch (err) {
    logger.error(
      { userId: row.user_id, err: err.message },
      'password reset OK but Redis session revoke failed — user should re-login anyway',
    );
  }

  logger.info({ userId: row.user_id }, 'password reset completed; sessions revoked');

  return { message: 'Password has been reset. Please log in.' };
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
};
