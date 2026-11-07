import { Pill } from '@/components/ui';
import { PRINT_LABEL } from '@/lib/orders/print-status.mjs';

/** Honest receipt status: "Printed" only when the cashier confirmed it. A browser cannot see the printer. */
export default function PrintStatusPill({ status, attempts = 0 }) {
  const [tone, label, why] = PRINT_LABEL[status] ?? PRINT_LABEL.NOT_REQUESTED;
  return <span title={`${why}${attempts > 1 ? ` (${attempts} print attempts)` : ''}`}><Pill tone={tone}>{label}</Pill></span>;
}
