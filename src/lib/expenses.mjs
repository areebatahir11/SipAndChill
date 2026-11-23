// Pure expense rules. Plain ESM with relative imports only, so the server, the screens and the tests share one implementation.
// Money is handled as INTEGER paisa (see money.mjs); a float never decides an amount.

import { MAX_MINOR, fromMinor, toMinor } from './money.mjs';
import { PAYMENT_METHODS } from './payments.mjs';
import { localDateString } from './orders/dates.mjs';

export { PAYMENT_METHODS, fromMinor };
export const SOURCES = ['MANUAL', 'STOCK_PURCHASE'];

/** Created per shop the first time Expenses or a stock purchase is used. The first one is app-owned. */
export const STOCK_PURCHASE_CATEGORY = 'Stock Purchase';
export const DEFAULT_CATEGORIES = [
  STOCK_PURCHASE_CATEGORY, 'Rent', 'Salaries', 'Electricity & Gas', 'Water', 'Internet & Phone',
  'Transport', 'Repairs & Maintenance', 'Cleaning', 'Other',
];

/** "1250" | 1250.5 -> integer paisa, or null when it is not a positive plain amount with at most 2 decimals. */
export function parseAmountMinor(value) {
  try {
    const minor = toMinor(value);
    return minor > 0 && minor <= MAX_MINOR ? minor : null;
  } catch {
    return null;
  }
}

/**
 * Cost of one purchase line: quantity (max 3 decimals) x unit cost (max 2 decimals), rounded to the nearest paisa.
 * BigInt keeps the multiplication exact even for large quantities.
 */
export function lineTotalMinor(quantity, unitCost) {
  const qtyMilli = Math.round(Number(quantity) * 1000);
  if (!Number.isSafeInteger(qtyMilli) || qtyMilli <= 0) throw new RangeError('Quantity must be greater than zero.');
  const cost = toMinor(unitCost ?? 0);
  const total = Number((BigInt(qtyMilli) * BigInt(cost) + 500n) / 1000n);
  if (total > MAX_MINOR) throw new RangeError('This purchase is too large.');
  return total;
}

/** lines: [{ quantity, unitCost }] -> per-line paisa and the grand total. */
export function purchaseTotals(lines) {
  const priced = lines.map((l) => ({ ...l, lineMinor: lineTotalMinor(l.quantity, l.unitCost) }));
  const totalMinor = priced.reduce((sum, l) => sum + l.lineMinor, 0);
  if (totalMinor > MAX_MINOR) throw new RangeError('This purchase is too large.');
  return { lines: priced, totalMinor };
}

/** Money received minus money spent, in paisa-exact arithmetic. Can be negative (spent more than received). */
export function leftAfterSpending(receivedMinor, spentMinor) {
  return receivedMinor - spentMinor;
}

/** Decimal(12,2) from the database (string | number | Decimal) -> integer paisa. */
export function decimalToMinor(value) {
  return Math.round(Number(value ?? 0) * 100);
}
export const minorToNumber = (minor) => Number(fromMinor(Math.abs(minor))) * (minor < 0 ? -1 : 1);

/** Inclusive business-date bounds (YYYY-MM-DD strings) for a dashboard range, so expenses use the same date filters as sales. */
export function businessDateBounds(range) {
  return { from: localDateString(range.start), to: localDateString(new Date(range.end.getTime() - 1)) };
}

/** Only hand-typed expenses can be voided here. A stock purchase must be corrected from the Stock page so stock and money stay in step. */
export function voidProblem(expense) {
  if (expense.voidedAt) return 'This expense is already voided.';
  if (expense.source !== 'MANUAL') return 'This came from a stock purchase. Correct it from the Stock page (wastage or stock count) instead.';
  return null;
}

/** The word a platform admin must type to confirm a permanent delete (checked by the server, not just the form). */
export const PURGE_CONFIRM_PHRASE = 'PURGE';

/**
 * Permanent deletion (Business Owner only) is a last resort, so it is narrower than voiding:
 * only an expense that was already voided, and only a hand-typed one (stock purchases are tied to stock movements).
 */
export function purgeProblem(expense) {
  if (!expense.voidedAt) return 'Only a voided expense can be permanently deleted. Void it first.';
  if (expense.source !== 'MANUAL') return 'This came from a stock purchase and is linked to stock records. It cannot be deleted.';
  return null;
}

/** A business date for an expense must be a real day, not in the future and not more than a year back (catches typos like 2025). */
export function dateProblem(day, today) {
  if (day > today) return 'The date cannot be in the future.';
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() - 366);
  if (new Date(`${day}T00:00:00Z`) < limit) return 'The date is more than a year ago.';
  return null;
}
