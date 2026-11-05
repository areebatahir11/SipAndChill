import { Pill } from '@/components/ui';

const PAY = { PAID: ['ok', 'Paid'], PARTIAL: ['neutral', 'Partially paid'], UNPAID: ['alert', 'Unpaid'] };

/** Cancelled orders show one pill; the payment state of a cancelled order is not a sale. */
export function OrderStatusPills({ order }) {
  if (order.status === 'CANCELLED') return <Pill tone="off">Cancelled</Pill>;
  const [tone, label] = PAY[order.paymentStatus];
  return <Pill tone={tone}>{label}</Pill>;
}
