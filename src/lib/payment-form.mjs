// The "how did the customer pay?" form on the counter and on the order page: what the cashier typed -> rows for the server.
// Pure ESM (no React): the screens and the tests share it. The server still checks everything again in settlePayments().

import { fromMinor, toMinor } from './money.mjs';
import { ONLINE_METHODS, REFERENCE_RE, methodLabel, normalizeReference, settlePayments } from './payments.mjs';

/** A fresh form: cash is on (the usual case), online is off. */
export const emptyPayForm = () => ({
  cash: true,
  online: false,
  cashAmount: '',
  methods: Object.fromEntries(ONLINE_METHODS.map((m) => [m, { on: false, amount: '', reference: '' }])),
});

const parse = (v) => { try { return toMinor(v === '' || v == null ? 0 : String(v).trim()); } catch { return null; } };

/**
 * Turns the form into payment rows and a live preview.
 *   dueMinor = what is still to pay (the order total, or an order's outstanding amount)
 *   returns { payments, pay, error }
 *     payments = [{ method, amountMinor, reference }]   (send these, see payloadOf)
 *     pay      = settlePayments() result: change, outstanding, status
 *     error    = a sentence for the cashier, or '' when the form is fine
 *
 * An online amount may be left empty ONLY when it is the one online method and no cash is entered: it then means "the full amount".
 */
export function readPayForm(form, dueMinor) {
  const payments = [];
  const fail = (error) => ({ payments: [], pay: null, error });

  const cashMinor = form.cash ? parse(form.cashAmount) : 0;
  if (cashMinor === null) return fail('Enter a valid cash amount (up to 2 decimals).');

  if (form.online) {
    const picked = ONLINE_METHODS.filter((m) => form.methods[m]?.on);
    if (picked.length === 0) return fail('Choose JazzCash, Easypaisa or Bank transfer.');
    const soleFull = picked.length === 1 && cashMinor === 0;
    for (const m of picked) {
      const f = form.methods[m];
      let amountMinor = parse(f.amount);
      if (amountMinor === null) return fail(`Enter a valid ${methodLabel(m)} amount (up to 2 decimals).`);
      if (amountMinor === 0) {
        if (!soleFull) return fail(`Enter the ${methodLabel(m)} amount.`);
        amountMinor = dueMinor;
      }
      if (amountMinor <= 0) return fail(`Nothing is left to pay with ${methodLabel(m)}.`);
      const reference = normalizeReference(f.reference) || null; // optional
      if (reference && !REFERENCE_RE.test(reference)) return fail(`The ${methodLabel(m)} transaction ID must be 4 to 40 letters or numbers (or leave it empty).`);
      payments.push({ method: m, amountMinor, reference });
    }
  }
  if (cashMinor > 0) payments.push({ method: 'CASH', amountMinor: cashMinor, reference: null });

  try {
    return { payments, pay: settlePayments(dueMinor, 0, payments), error: '' };
  } catch (e) {
    if (e instanceof RangeError) return fail(e.message);
    throw e;
  }
}

/** The JSON the API expects: amounts as "500.00" strings, a transaction ID only for online rows. */
export const payloadOf = (payments) => payments.map((p) => ({ method: p.method, amount: fromMinor(p.amountMinor), ...(p.reference ? { reference: p.reference } : {}) }));

/** What the cashier has typed as online amounts so far (explicit amounts only): the cash "Exact" button pays the rest. */
export function typedOnlineMinor(form) {
  if (!form.online) return 0;
  return ONLINE_METHODS.filter((m) => form.methods[m]?.on).reduce((s, m) => s + (parse(form.methods[m].amount) ?? 0), 0);
}
