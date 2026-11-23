import { z } from 'zod';
import { businessDay, localDateString } from '@/lib/orders/dates.mjs';
import { decimalPlaces } from '@/lib/money.mjs';
import { dateProblem, parseAmountMinor, PAYMENT_METHODS, PURGE_CONFIRM_PHRASE } from '@/lib/expenses.mjs';
import { optionalText, requiredName } from './common';

/** Money from a form field ("1500", 1500.5). Becomes integer paisa; > 0, at most 2 decimals. */
export const amountMinor = (label = 'Amount') =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    const minor = parseAmountMinor(typeof v === 'string' ? v.trim() : v);
    if (minor === null) {
      ctx.addIssue({ code: 'custom', message: `${label} must be more than zero, with at most 2 decimal places.` });
      return z.NEVER;
    }
    return minor;
  });

/** Optional business day (YYYY-MM-DD). Empty = today. Never in the future. */
export const expenseDate = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    const today = localDateString(businessDay());
    const day = v || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) {
      ctx.addIssue({ code: 'custom', message: 'Use a valid date.' });
      return z.NEVER;
    }
    const problem = dateProblem(day, today);
    if (problem) {
      ctx.addIssue({ code: 'custom', message: problem });
      return z.NEVER;
    }
    return day;
  });

export const methodSchema = z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: 'Choose how it was paid.' }) }).default('CASH');
const id = (label) => z.string().trim().min(1, `Choose ${label}.`).max(60);
const optionalId = z.string().trim().max(60).transform((v) => v || null).nullable().optional();

export const createExpenseSchema = z.object({
  categoryId: id('a category'),
  amount: amountMinor('Amount'),
  method: methodSchema,
  businessDate: expenseDate,
  supplierId: optionalId,
  note: optionalText(200),
});

export const voidExpenseSchema = z.object({
  reason: z.string().trim().min(3, 'Please write a short reason.').max(200),
});

/** Permanent delete of one voided expense: a real reason plus the typed confirmation word, both enforced on the server. */
export const purgeExpenseSchema = z.object({
  reason: z.string().trim().min(10, 'Please write why this must be deleted (at least 10 characters).').max(300),
  confirm: z.string().trim().refine((v) => v === PURGE_CONFIRM_PHRASE, `Type ${PURGE_CONFIRM_PHRASE} to confirm.`),
});

export const createCategorySchema = z.object({ name: requiredName('Name') });
export const updateCategorySchema = z
  .object({ name: requiredName('Name').optional(), isActive: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

const qty = z.coerce.number({ invalid_type_error: 'Quantity must be a number.' }).gt(0, 'Quantity must be greater than zero.').max(9_999_999).refine((v) => decimalPlaces(v) <= 3, 'Quantity can have at most 3 decimal places.');
const cost = z.preprocess((v) => (v === '' || v == null ? 0 : v), z.coerce.number().min(0).max(9_999_999).refine((v) => decimalPlaces(v) <= 2, 'Cost can have at most 2 decimal places.'));

/** One shopping trip: several stock items bought together and paid in one go. */
export const purchaseSchema = z.object({
  supplierId: optionalId,
  invoiceNo: optionalText(60),
  businessDate: expenseDate,
  method: methodSchema,
  amountPaid: amountMinor('Amount paid').optional(), // blank = exactly the total of the lines
  items: z
    .array(z.object({ ingredientId: id('an item'), quantity: qty, unitCost: cost }))
    .min(1, 'Add at least one item.')
    .max(40, 'At most 40 items in one purchase.'),
});
