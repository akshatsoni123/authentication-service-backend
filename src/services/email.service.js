const nodemailer = require('nodemailer');
const { config } = require('../config');
const { logger } = require('../utils/logger');

/** @type {import('nodemailer').Transporter | null} */
let transporter = null;

/** @type {Promise<import('nodemailer').Transporter> | null} */
let transporterPromise = null;

/**
 * Build SMTP transport from env, or Ethereal test account in development
 * when SMTP_USER / SMTP_PASS are empty.
 */
async function getTransporter() {
  if (transporter) return transporter;
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    if (config.smtp.user && config.smtp.pass) {
      transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: false,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      });
      logger.info({ host: config.smtp.host }, 'email transport: configured SMTP');
      return transporter;
    }

    if (config.isDev || config.isTest) {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      logger.info(
        { user: testAccount.user },
        'email transport: Ethereal test account (no SMTP_USER/PASS set)',
      );
      return transporter;
    }

    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: false,
    });
    logger.warn('email transport: SMTP without auth (production misconfig?)');
    return transporter;
  })();

  try {
    return await transporterPromise;
  } catch (err) {
    transporterPromise = null;
    throw err;
  }
}

/**
 * Best-effort verification email. Failures are logged; caller should not fail registration.
 * @param {{ to: string, rawToken: string }} input
 */
async function sendVerificationEmail({ to, rawToken }) {
  const text = [
    'Verify your email for Authentication Service.',
    '',
    `Your verification token: ${rawToken}`,
    '',
    `POST ${config.appUrl}/api/v1/auth/verify-email`,
    'Body: { "token": "<token above>" }',
    '',
    'This token expires in 24 hours. After a successful verify, repeating the same request stays successful (idempotent).',
  ].join('\n');

  return sendMail({
    to,
    subject: 'Verify your email',
    text,
    successLog: 'verification email sent',
    failLog: 'verification email FAILED — user may still use resend-verification',
  });
}

/**
 * Best-effort password-reset email. Failures are logged; forgot-password still returns 200.
 * @param {{ to: string, rawToken: string }} input
 */
async function sendPasswordResetEmail({ to, rawToken }) {
  const text = [
    'Reset your Authentication Service password.',
    '',
    `Reset token: ${rawToken}`,
    '',
    `POST ${config.appUrl}/api/v1/auth/reset-password`,
    'Body: { "token": "<token above>", "newPassword": "<new password>" }',
    '',
    'This token expires in 1 hour and can be used once.',
  ].join('\n');

  return sendMail({
    to,
    subject: 'Reset your password',
    text,
    successLog: 'password reset email sent',
    failLog: 'password reset email FAILED',
  });
}

/**
 * Shared send helper — keeps transporter/error handling in one place.
 */
async function sendMail({ to, subject, text, successLog, failLog }) {
  try {
    const transport = await getTransporter();
    const info = await transport.sendMail({
      from: config.smtp.from,
      to,
      subject,
      text,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    logger.info(
      { to, messageId: info.messageId, previewUrl: previewUrl || undefined },
      successLog,
    );
    return { sent: true, messageId: info.messageId, previewUrl: previewUrl || null };
  } catch (err) {
    logger.error(
      { to, err: err instanceof Error ? err.message : err },
      failLog,
    );
    return { sent: false, error: err instanceof Error ? err.message : 'send_failed' };
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  getTransporter,
};
