import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';
import { planStatus } from '@/lib/platform/billing.mjs';

/**
 * The business's own plan, as its owner may see it: fee, due date, last payment and the derived status.
 * Deliberately selects only these columns: PearlSolutions' internal note must never reach a client.
 * Cached per request, so the layout (sidebar chip, banner) and the Plan & Billing page share one query.
 */
export const getPlan = cache(async (tenantId) => {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { currency: true, billingStatus: true, monthlyFee: true, dueDate: true, lastPaidAt: true },
  });
  if (!t) return null;
  return { currency: t.currency, ...planStatus(t) };
});

/** PearlSolutions' bank details, set in the environment so they can change without a code change. Null bank = not configured yet. */
export function paymentContact() {
  const env = (k) => (process.env[k] || '').trim();
  const bank = { name: env('BILLING_BANK_NAME'), title: env('BILLING_ACCOUNT_TITLE'), accountNumber: env('BILLING_ACCOUNT_NUMBER'), iban: env('BILLING_IBAN') };
  return {
    bank: bank.accountNumber || bank.iban ? bank : null,
    email: env('BILLING_SUPPORT_EMAIL') || env('ADMIN_NOTIFY_EMAIL') || null,
  };
}
