import { z } from 'zod';
import { toMinor } from '@/lib/money.mjs';

/** Money from a form/JSON: string or number, max 2 decimals, never negative. Output is integer paisa. */
const money = (label) =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    try { return toMinor(v === '' ? 0 : v); } catch {
      ctx.addIssue({ code: 'custom', message: `${label} must be a valid amount (at most 2 decimals).` });
      return z.NEVER;
    }
  });

export const createOrderSchema = z.object({
  clientRequestId: z.string().trim().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/, 'Invalid request id.'),
  items: z.array(z.object({
    productId: z.string().trim().min(1).max(40),
    quantity: z.coerce.number({ invalid_type_error: 'Quantity must be a number.' }).int('Quantity must be a whole number.').min(1, 'Quantity must be at least 1.').max(999),
  })).min(1, 'Add at least one item.').max(60, 'Too many different items in one order.'),
  amountReceived: money('Amount received').default('0'),
});

export const paymentSchema = z.object({
  amountReceived: money('Amount received').refine((v) => v > 0, 'Enter the amount received.'),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3, 'Please give a short reason.').max(200),
  restock: z.boolean().default(false),
});

export const listOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  filter: z.enum(['all', 'paid', 'partial', 'unpaid', 'cancelled']).default('all'),
  q: z.string().trim().max(10).regex(/^\d*$/, 'Search by order number.').default(''),
});
