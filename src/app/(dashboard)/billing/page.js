import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { plain } from '@/lib/plain';
import { PageHeader } from '@/components/ui';
import { getPlan, paymentContact } from '@/modules/billing/service';
import PlanOverview from '@/features/billing/PlanOverview';

export const metadata = { title: 'Plan & Billing' };

/** The owner's view of what they pay PearlSolutions: free trial, monthly fee, due date. */
export default async function BillingPage() {
  const auth = await requirePage(P.SETTINGS_MANAGE); // Business Owner only; managers and staff never see the fee
  const plan = await getPlan(auth.tenantId);
  return (
    <>
      <PageHeader title="Plan & Billing" sub="Your free trial, monthly fee and next payment." />
      {plan && <PlanOverview plan={plain(plan)} contact={paymentContact()} shopName={auth.tenant.name} />}
    </>
  );
}
