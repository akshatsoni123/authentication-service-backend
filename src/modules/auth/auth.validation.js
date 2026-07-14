const { z } = require('zod');

/** Shared password policy (register + reset) — Issue #06 / #10 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const emailSchema = z
  .string()
  .trim()
  .email('Invalid email format')
  .max(320)
  .transform((value) => value.toLowerCase());

const registerBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const verifyEmailBodySchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const resendVerificationBodySchema = z.object({
  email: emailSchema,
});

const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordBodySchema = z.object({
  email: emailSchema,
});

const resetPasswordBodySchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: passwordSchema,
});

module.exports = {
  passwordSchema,
  registerBodySchema,
  verifyEmailBodySchema,
  resendVerificationBodySchema,
  loginBodySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
};
