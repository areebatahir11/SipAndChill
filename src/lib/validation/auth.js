import { z } from 'zod';
import { BUSINESS_TYPES } from '@/lib/platform/constants.mjs';
import { requiredName } from './common';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);

// bcrypt only uses the first 72 bytes, so cap the length instead of silently truncating.
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(72, 'Password must be at most 72 characters.')
  .regex(/[A-Za-z]/, 'Password must contain a letter.')
  .regex(/\d/, 'Password must contain a number.');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(72),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordSchema,
});

/** Public signup. `website` is a honeypot: real users never see it, bots fill it. */
export const signupSchema = z.object({
  businessName: requiredName('Business name'),
  businessType: z.enum(Object.keys(BUSINESS_TYPES)),
  ownerName: requiredName('Your name'),
  email: emailSchema,
  password: passwordSchema,
  website: z.string().max(200).optional(),
});


export const passwordResetRequestSchema = z.object({ email: emailSchema });
export const passwordResetCompleteSchema = z.object({
  email: emailSchema,
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
  newPassword: passwordSchema,
});
