// Special (hand-typed) discount for a regular customer. Pure ESM: the POS screen, the API validation and the order service
// all use these same rules, so the counter can never show a discount the server would refuse.
//
// The cashier types the rupees to take off the bill (e.g. 100). It is stored in the order's existing `discount` column
// (together with any menu promotion), so totals, payments, receipts and reports need no change and the order is never "partially paid" by mistake.

import { toMinor } from '../money.mjs';

/** Largest special discount on ONE order, in rupees. Change this single number to raise or lower the limit everywhere. */
export const MAX_MANUAL_DISCOUNT = 999;
export const MAX_MANUAL_DISCOUNT_MINOR = MAX_MANUAL_DISCOUNT * 100;

/** The customer always pays at least this much (Rs 1), so a bill is never reduced to zero by mistake. */
export const MIN_PAYABLE_MINOR = 100;

export const MANUAL_DISCOUNT_LABEL = 'Special';

/**
 * Checks a discount in paisa against what the customer would otherwise owe (bill after any menu promotion).
 * Returns an error message, or null when it is fine. 0 means "no special discount" and is always fine.
 */
export function manualDiscountProblem(discountMinor, payableMinor) {
  if (!Number.isSafeInteger(discountMinor) || discountMinor < 0) return 'Discount cannot be negative.';
  if (discountMinor === 0) return null;
  if (discountMinor > MAX_MANUAL_DISCOUNT_MINOR) return `Discount cannot be more than Rs ${MAX_MANUAL_DISCOUNT}.`;
  if (discountMinor > payableMinor - MIN_PAYABLE_MINOR) return 'Discount is too high for this bill. The customer must still pay at least Rs 1.';
  return null;
}

/** What the cashier typed -> { minor, error }. Blank means no discount. Letters, minus signs and 3+ decimals are errors. */
export function parseManualDiscount(text, payableMinor) {
  const s = String(text ?? '').trim();
  if (s === '') return { minor: 0, error: '' };
  let minor;
  try { minor = toMinor(s); } catch { return { minor: 0, error: 'Enter a plain amount, for example 100.' }; }
  const error = manualDiscountProblem(minor, payableMinor);
  return { minor: error ? 0 : minor, error: error ?? '' };
}

/** Label saved on the order (and printed): "Special", or "20% OFF + Special" when a menu promotion is also running. */
export const combinedDiscountLabel = (promoShort, hasManual) => {
  if (!hasManual) return promoShort || null;
  return promoShort ? `${promoShort} + ${MANUAL_DISCOUNT_LABEL}` : MANUAL_DISCOUNT_LABEL;
};
