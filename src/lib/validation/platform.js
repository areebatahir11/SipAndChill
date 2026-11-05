import { z } from 'zod';
import { BILLING_STATUS, BUSINESS_TYPES } from '@/lib/platform/constants.mjs';
import { emailSchema, passwordSchema } from './auth';
import { nonNegative, optionalText, requiredName } from './common';

const businessType = z.enum(Object.keys(BUSINESS_TYPES));
const billingStatus = z.enum(Object.values(BILLING_STATUS));

const toUtcDate = (v) => new Date(`${v}T00:00:00.000Z`);
// Round-trip check: "2026-02-31" is rejected instead of silently becoming March 3.
const isRealDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && toUtcDate(v).toISOString().slice(0, 10) === v;

/** "YYYY-MM-DD" (from <input type="date">) -> Date at UTC midnight; "" or null -> null. */
export const dateOnly = z
  .string()
  .trim()
  .refine((v) => v === '' || isRealDate(v), 'Enter a valid date.')
  .transform((v) => (v === '' ? null : toUtcDate(v)))
  .nullable();

export const createClientSchema = z.object({
  businessName: requiredName('Business name'),
  businessType,
  monthlyFee: nonNegative('Monthly fee'),
  dueDate: dateOnly.optional(),
  owner: z.object({ name: requiredName('Owner name'), email: emailSchema, password: passwordSchema }),
});

export const updateClientSchema = z
  .object({
    businessName: requiredName('Business name').optional(),
    businessType: businessType.optional(),
    monthlyFee: nonNegative('Monthly fee').optional(),
    dueDate: dateOnly.optional(),
    billingStatus: billingStatus.optional(),
    internalNote: optionalText(500),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

export const resetOwnerPasswordSchema = z.object({
  userId: z.string().min(1, 'Choose an owner.'),
  newPassword: passwordSchema,
});
