import { dayLabel } from '@/lib/orders/dates.mjs';

/**
 * "#2" with the day it belongs to, so #2 of today is never mistaken for #2 of yesterday.
 * Numbers restart at #1 every day; the small tag after it is the day ("Today", "Yesterday", "9 Nov").
 */
export default function OrderNo({ no, date, className = '' }) {
  const label = dayLabel(date);
  const today = label === 'Today';
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap ${className}`}>
      <b>#{no}</b>
      {label && <span className={`rounded-md border px-1.5 py-px text-[11px] font-medium ${today ? 'border-sand bg-sand text-night' : 'border-peach bg-blush text-graphite'}`}>{label}</span>}
    </span>
  );
}
