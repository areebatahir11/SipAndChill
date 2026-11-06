// Decimal-safe money. All arithmetic is done on INTEGER minor units (paisa), never on floats.
// Pure ESM so server code, client code and tests share one implementation.

const MONEY_RE = /^\d{1,10}(\.\d{1,2})?$/;

/** Largest amount a DECIMAL(12,2) column holds (9,999,999,999.99), in paisa. Anything bigger would be rejected by the database. */
export const MAX_MINOR = 999_999_999_999;

/** Number of digits after the decimal point of a JS number (Infinity for exponent notation such as 1e-7). */
export function decimalPlaces(n) {
  const s = String(n);
  if (/e/i.test(s)) return Infinity;
  return (s.split('.')[1] || '').length;
}

/** "12.5" | 12.5 | "12" -> 1250. Throws on anything that is not a plain non-negative amount with max 2 decimals. */
export function toMinor(value) {
  const s = typeof value === 'number' ? String(value) : String(value ?? '').trim();
  if (!MONEY_RE.test(s)) throw new RangeError(`Invalid money amount: ${value}`);
  const [whole, frac = ''] = s.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/** 1250 -> "12.50" (string, safe to hand to a Postgres DECIMAL column). */
export function fromMinor(minor) {
  if (!Number.isSafeInteger(minor) || minor < 0) throw new RangeError(`Invalid minor amount: ${minor}`);
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}

/** Order totals from DB prices. lines: [{ unitPriceMinor, quantity }] with integer quantity >= 1. */
export function calcOrder(lines, discountMinor = 0) {
  const items = lines.map((l) => {
    if (!Number.isInteger(l.quantity) || l.quantity < 1) throw new RangeError('Quantity must be a whole number of at least 1.');
    return { ...l, lineTotalMinor: l.unitPriceMinor * l.quantity };
  });
  const subtotalMinor = items.reduce((s, l) => s + l.lineTotalMinor, 0);
  if (discountMinor < 0 || discountMinor > subtotalMinor) throw new RangeError('Invalid discount.');
  return { items, subtotalMinor, discountMinor, totalMinor: subtotalMinor - discountMinor };
}

/**
 * One cash payment against an order.
 *   applied     = part of the cash that settles the order (never more than what is still owed)
 *   change      = max(received - owed, 0)         <- customer change, NOT a refund
 *   outstanding = max(owed - received, 0)
 */
export function calcPayment(totalMinor, alreadyPaidMinor, receivedMinor) {
  const owed = Math.max(totalMinor - alreadyPaidMinor, 0);
  const appliedMinor = Math.min(receivedMinor, owed);
  const changeMinor = Math.max(receivedMinor - owed, 0);
  const paidMinor = alreadyPaidMinor + appliedMinor;
  const outstandingMinor = Math.max(totalMinor - paidMinor, 0);
  return { appliedMinor, changeMinor, paidMinor, outstandingMinor, status: paymentStatus(totalMinor, paidMinor) };
}

export function paymentStatus(totalMinor, paidMinor) {
  if (paidMinor >= totalMinor) return 'PAID';
  return paidMinor > 0 ? 'PARTIAL' : 'UNPAID';
}
