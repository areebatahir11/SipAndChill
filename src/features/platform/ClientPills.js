import { Pill } from '@/components/ui';

/** Paid / Unpaid / Overdue. `client.billing` is computed on the server. */
export const BillingPill = ({ client }) => <Pill tone={client.billing.tone}>{client.billing.label}</Pill>;

export const AccessPill = ({ client }) => {
  if (client.status === 'PENDING') return <Pill tone="alert">Pending approval</Pill>;
  if (client.status === 'REJECTED') return <Pill tone="off">Rejected</Pill>;
  return <Pill tone={client.isActive ? 'ok' : 'off'}>{client.isActive ? 'Active' : 'Suspended'}</Pill>;
};
