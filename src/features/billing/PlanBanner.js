import Link from 'next/link';
import { managerNotice, planSentence } from './plan-ui';

const tones = {
  warn: 'border-graphite bg-peach text-night',
  alert: 'border-night bg-graphite text-blush',
};

/**
 * Reminder across the top of every page, only when action is near (trial ending, payment due, overdue). Server component.
 * Owner: full sentence with the amount and a link to Plan & Billing.
 * Manager: their own wording (managerNotice), no money and no link (they cannot open the billing page).
 */
export default function PlanBanner({ plan, isOwner }) {
  if (!plan?.needsAttention) return null;
  const alert = plan.tone === 'alert';
  const manager = isOwner ? null : managerNotice(plan);
  return (
    <div role={alert ? 'alert' : 'status'} className={`mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-2xl border-l-4 px-4 py-3 ${tones[plan.tone]}`}>
      <p className="m-0 min-w-0">
        <b className="mr-2 font-semibold">{manager ? manager.headline : plan.headline}.</b>
        <span className={alert ? 'text-sand' : 'text-graphite'}>
          {isOwner ? planSentence(plan) : manager.text}
        </span>
      </p>
      {isOwner && (
        <Link href="/billing" className={`whitespace-nowrap rounded-[10px] border px-3.5 py-1.5 text-[13.5px] font-medium transition-colors ${alert ? 'border-sand text-sand hover:bg-night' : 'border-graphite text-night hover:bg-graphite hover:text-blush'}`}>
          View plan &amp; how to pay
        </Link>
      )}
    </div>
  );
}
