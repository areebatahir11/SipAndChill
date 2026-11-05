import { sortByUrgency, summarizeClients } from '@/lib/platform/billing.mjs';
import { BILLING_STATUS } from '@/lib/platform/constants.mjs';
import { listClients } from './clients';

const ATTENTION_LIMIT = 6;
const SUSPENDED_LIMIT = 10;

/** Everything the PearlSolutions dashboard shows. Client counts are small, so one query + in-memory maths is enough. */
export async function getOverview() {
  const clients = await listClients();
  const needsPayment = clients.filter((c) => c.isActive && c.billingStatus === BILLING_STATUS.UNPAID);
  return {
    summary: summarizeClients(clients),
    attention: sortByUrgency(needsPayment).slice(0, ATTENTION_LIMIT),
    suspended: clients.filter((c) => !c.isActive).slice(0, SUSPENDED_LIMIT),
  };
}
