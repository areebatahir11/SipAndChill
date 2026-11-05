import { Pill } from '@/components/ui';

/** Paid / Unpaid / Overdue. `client.billing` is computed on the server. */
export const BillingPill = ({ client }) => <Pill tone={client.billing.tone}>{client.billing.label}</Pill>;

export const AccessPill = ({ client }) => (
  <Pill tone={client.isActive ? 'ok' : 'off'}>{client.isActive ? 'Active' : 'Suspended'}</Pill>
);
