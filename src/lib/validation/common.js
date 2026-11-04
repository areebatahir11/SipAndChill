import { z } from 'zod';

/** Trimmed optional text; empty string becomes null so the column is cleared. */
export const optionalText = (max) =>
  z.string().trim().max(max).transform((v) => (v === '' ? null : v)).nullable().optional();

export const requiredName = (label = 'Name') =>
  z.string().trim().min(2, `${label} is too short.`).max(80, `${label} is too long.`);

/** Non-negative number from a form field (accepts "12", 12, ""). Empty means 0. */
export const nonNegative = (label) =>
  z.preprocess((v) => (v === '' || v == null ? 0 : v), z.coerce.number({ invalid_type_error: `${label} must be a number.` }).min(0, `${label} cannot be negative.`).max(9_999_999));
