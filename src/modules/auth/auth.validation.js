const { z } = require('zod');

const registerBodySchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email format')
    .max(320)
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

const verifyEmailBodySchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const resendVerificationBodySchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email format')
    .transform((value) => value.toLowerCase()),
});

// Login only needs email + password (same email normalize as register)
const loginBodySchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email format')
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

module.exports = {
  registerBodySchema,
  verifyEmailBodySchema,
  resendVerificationBodySchema,
  loginBodySchema,
};
