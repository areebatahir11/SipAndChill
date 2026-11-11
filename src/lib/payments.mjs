// How an order was paid. Pure ESM: the counter screen, the server and the tests all use this one set of rules.
//
// Customers pay the SHOP directly (cash, or a transfer into the shop's own JazzCash / Easypaisa / bank account);
// the software records how, it never holds the money. "Online" is only a group in the screen: it is not stored.

import { paymentStatus } from './money.mjs';

export const PAYMENT_METHODS = ['CASH', 'JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'];
export const ONLINE_METHODS = ['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'];
export const METHOD_LABEL = { CASH: 'Cash', JAZZCASH: 'JazzCash', EASYPAISA: 'Easypaisa', BANK_TRANSFER: 'Bank transfer' };

export const isOnline = (method) => ONLINE_METHODS.includes(method);
export const methodLabel = (method) => METHOD_LABEL[method] ?? 'Cash'; // old rows and test data without a method are cash

/** Transaction IDs are optional. When given: 4-40 letters, digits, "-" or "_" (spaces are ignored, case does not matter). */
export const REFERENCE_RE = /^[A-Z0-9_-]{4,40}$/;
export const normalizeReference = (v) => String(v ?? '').replace(/\s+/g, '').toUpperCase();

/** Receipts show only the end of a transaction ID: "TX123456789" -> "••••6789". */
export const maskReference = (ref) => (ref ? `••••${String(ref).slice(-4)}` : '');

/**
 * Splits what the customer handed over into the rows we save, and works out the order's payment state.
 *
 *   payments = [{ method, amountMinor, reference }]   (integer paisa; at most one row per method)
 *
 * Rules (the server enforces them, the screen uses the same function to preview):
 *   - every row needs a method and an amount above zero;
 *   - JazzCash / Easypaisa / bank rows may carry a transaction ID (optional, but valid and unused when given); cash rows have none;
 *   - online money is exact: it can never be more than what is still due (only cash gives change);
 *   - online rows are applied first, cash settles what is left, and any cash above that is change.
 *
 * Throws RangeError with a message the cashier can act on.
 */
export function settlePayments(totalMinor, alreadyPaidMinor, payments = []) {
  const owed = Math.max(totalMinor - alreadyPaidMinor, 0);
  const seen = new Set();
  const online = [];
  let cash = null;

  for (const p of payments) {
    if (!PAYMENT_METHODS.includes(p.method)) throw new RangeError('Choose how the customer paid.');
    const label = methodLabel(p.method);
    if (seen.has(p.method)) throw new RangeError(`${label} is listed twice. Use one amount for it.`);
    seen.add(p.method);
    if (!Number.isInteger(p.amountMinor) || p.amountMinor <= 0) throw new RangeError(`Enter the ${label} amount.`);
    if (p.method === 'CASH') { cash = p; continue; }
    const reference = normalizeReference(p.reference) || null;
    if (reference && !REFERENCE_RE.test(reference)) throw new RangeError(`The ${label} transaction ID must be 4 to 40 letters or numbers (or leave it empty).`);
    online.push({ method: p.method, reference, amountReceivedMinor: p.amountMinor, appliedMinor: p.amountMinor, changeMinor: 0 });
  }

  const onlineMinor = online.reduce((s, r) => s + r.appliedMinor, 0);
  if (onlineMinor > owed) throw new RangeError('The online amount is more than what is due. Only cash can give change.');

  const rows = [...online];
  let cashAppliedMinor = 0;
  if (cash) {
    cashAppliedMinor = Math.min(cash.amountMinor, owed - onlineMinor);
    if (cashAppliedMinor === 0) throw new RangeError('Nothing is left to pay in cash. Remove the cash amount.');
    rows.push({ method: 'CASH', reference: null, amountReceivedMinor: cash.amountMinor, appliedMinor: cashAppliedMinor, changeMinor: cash.amountMinor - cashAppliedMinor });
  }

  const appliedMinor = onlineMinor + cashAppliedMinor;
  const paidMinor = alreadyPaidMinor + appliedMinor;
  return {
    rows,
    appliedMinor,
    onlineMinor,
    cashAppliedMinor,
    changeMinor: rows.reduce((s, r) => s + r.changeMinor, 0),
    paidMinor,
    outstandingMinor: Math.max(totalMinor - paidMinor, 0),
    status: paymentStatus(totalMinor, paidMinor),
  };
}
