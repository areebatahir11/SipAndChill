'use client';
import Link from 'next/link';
import { useAuth } from '@/components/layout/AuthProvider';
import { planSentence } from './plan-ui';

const toneClass = {
  ok: 'border-taupe/50 bg-slate',
  neutral: 'border-taupe/50 bg-slate',
  warn: 'border-sand bg-slate',
  alert: 'border-blush bg-graphite',
};

/** Small card at the bottom of the owner's sidebar: always shows where the free trial / plan stands. Links to Plan & Billing. */
export default function PlanChip() {
  const { plan } = useAuth();
  if (!plan) return null;
  const trial = plan.state === 'TRIAL';
  return (
    <Link
      href="/billing"
      className={`block rounded-2xl border p-3 text-sand transition-colors hover:border-sand ${toneClass[plan.tone]}`}
      aria-label={`${plan.headline}. ${planSentence(plan)} Open Plan and Billing.`}
    >
      <span className="flex items-center justify-between gap-2">
        <b className="text-[13.5px] font-semibold leading-tight text-blush">{plan.headline}</b>
        {plan.needsAttention && <span aria-hidden className="grid size-4 flex-none place-items-center rounded-full bg-sand text-[10px] font-bold text-night">!</span>}
      </span>
      {trial && (
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-night" role="presentation">
          <span className="block h-full rounded-full bg-sand" style={{ width: `${Math.max(4, Math.round(plan.trialProgress * 100))}%` }} />
        </span>
      )}
      <small className="mt-1.5 block leading-snug text-taupe">{planSentence(plan)}</small>
    </Link>
  );
}
