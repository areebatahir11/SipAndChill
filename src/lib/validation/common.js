import { z } from 'zod';
import { decimalPlaces } from '@/lib/money.mjs';

/** Trimmed optional text; empty string becomes null so the column is cleared. */
export const optionalText = (max) =>
  z.string().trim().max(max).transform((v) => (v === '' ? null : v)).nullable().optional();

export const requiredName = (label = 'Name') =>
  z.string().trim().min(2, `${label} is too short.`).max(80, `${label} is too long.`);

/**
 * Non-negative number from a form field (accepts "12", 12, ""). Empty means 0.
 * decimals: 2 for money (default), 3 for stock quantities (the database columns are DECIMAL(12,2) / DECIMAL(12,3)).
 */
export const nonNegative = (label, decimals = 2) =>
  z.preprocess(
    (v) => (v === '' || v == null ? 0 : v),
    z.coerce.number({ invalid_type_error: `${label} must be a number.` })
      .min(0, `${label} cannot be negative.`)
      .max(9_999_999)
      .refine((v) => decimalPlaces(v) <= decimals, `${label} can have at most ${decimals} decimal places.`),
  );
