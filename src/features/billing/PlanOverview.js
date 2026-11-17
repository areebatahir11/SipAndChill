import { Card, Pill, StatCard } from '@/components/ui';
import { dateOnly, dateTime, money } from '@/lib/format';
import { TRIAL_DAYS } from '@/lib/platform/constants.mjs';
import { planSentence } from './plan-ui';
import CopyButton from './CopyButton';

const PILL = { ok: 'ok', neutral: 'off', warn: 'off', alert: 'alert' };
const PILL_LABEL = {
  TRIAL: 'Free trial', TRIAL_ENDED: 'Payment overdue', ACTIVE: 'Paid', UPCOMING: 'Unpaid', DUE_SOON: 'Due soon', OVERDUE: 'Overdue', SETUP: 'Setting up',
};

function Step({ n, title, children, state }) {
  const done = state === 'done';
  const current = state === 'current';
  return (
    <li className="flex gap-3.5">
      <span className={`mt-0.5 grid size-7 flex-none place-items-center rounded-full text-[13px] font-bold ${done ? 'bg-sand text-night' : current ? 'bg-night text-sand' : 'border border-peach bg-white text-graphite'}`}>
        {done ? '✓' : n}
      </span>
      <div className="min-w-0">
        <p className="m-0 font-semibold">{title}{current && <span className="ml-2 rounded-full bg-sand px-2 py-0.5 align-middle text-[11.5px] font-semibold text-night">You are here</span>}</p>
        <p className="m-0 text-[14px] text-graphite">{children}</p>
      </div>
    </li>
  );
}

/** The whole Plan & Billing page for a business owner. Server component: plain props, no client state. */
export default function PlanOverview({ plan, contact, shopName }) {
  const fee = plan.fee > 0 ? money(plan.fee, plan.currency) : 'Not set yet';
  const trialLength = plan.trialDays ?? TRIAL_DAYS;
  const everPaid = plan.state === 'ACTIVE' || Boolean(plan.lastPaidAt);
  const inTrial = plan.state === 'TRIAL';
  const dueLabel = plan.state === 'TRIAL' || plan.state === 'TRIAL_ENDED' ? 'Trial ends / first payment' : 'Next payment due';
  const needsPayment = ['TRIAL_ENDED', 'OVERDUE', 'DUE_SOON', 'UPCOMING'].includes(plan.state) || inTrial;

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Pill tone={PILL[plan.tone]}>{PILL_LABEL[plan.state]}</Pill>
            <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight">{plan.headline}</h2>
            <p className="mt-1 max-w-[60ch] text-graphite">{planSentence(plan)}</p>
          </div>
          {plan.fee > 0 && (
            <div className="text-right">
              <p className="m-0 text-3xl font-semibold tracking-tight">{money(plan.fee, plan.currency)}</p>
              <p className="m-0 text-[13px] text-graphite">per month</p>
            </div>
          )}
        </div>
        {inTrial && (
          <div className="mt-5">
            <div className="h-2.5 overflow-hidden rounded-full bg-peach/60" role="progressbar" aria-label="Free trial used" aria-valuemin={0} aria-valuemax={trialLength} aria-valuenow={plan.trialElapsed}>
              <div className="h-full rounded-full bg-night transition-[width]" style={{ width: `${Math.max(3, Math.round(plan.trialProgress * 100))}%` }} />
            </div>
            <p className="mt-1.5 flex justify-between text-[13px] text-graphite"><span>Day {Math.min(plan.trialElapsed + 1, trialLength)} of {trialLength}</span><span>Ends {dateOnly(plan.dueDate)}</span></p>
          </div>
        )}
      </Card>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        <StatCard label="Monthly fee" value={fee} hint={plan.fee > 0 ? 'After your free trial' : 'PearlSolutions will confirm'} />
        <StatCard label={dueLabel} value={plan.dueDate ? dateOnly(plan.dueDate) : '—'} hint={plan.daysLeft === null ? 'Date not set yet' : plan.daysLeft < 0 ? `${-plan.daysLeft} day(s) ago` : plan.daysLeft === 0 ? 'Today' : `In ${plan.daysLeft} day(s)`} />
        <StatCard label="Last payment" value={plan.lastPaidAt ? dateOnly(plan.lastPaidAt) : 'None yet'} hint={plan.lastPaidAt ? dateTime(plan.lastPaidAt) : 'Nothing is due during your trial'} />
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        <Card>
          <h3 className="mb-4 text-[17px] font-semibold">How your plan works</h3>
          <ol className="m-0 list-none space-y-4 p-0">
            <Step n="1" title={`${trialLength}-day free trial`} state={everPaid || plan.state === 'TRIAL_ENDED' ? 'done' : inTrial ? 'current' : 'next'}>
              Use everything for free. No payment is needed during the trial.
            </Step>
            <Step n="2" title={`Monthly fee${plan.fee > 0 ? `: ${money(plan.fee, plan.currency)}` : ''}`} state={plan.state === 'ACTIVE' ? 'done' : plan.state === 'TRIAL' || plan.state === 'SETUP' ? 'next' : 'current'}>
              When the trial ends, pay the monthly fee to PearlSolutions to keep your shop running.
            </Step>
            <Step n="3" title="We confirm your payment" state={plan.state === 'ACTIVE' ? 'done' : 'next'}>
              PearlSolutions marks you Paid and sets the next due date. This page updates by itself.
            </Step>
          </ol>
        </Card>

        <Card>
          <h3 className="mb-3 text-[17px] font-semibold">How to pay</h3>
          {contact.bank ? (
            <dl className="m-0 divide-y divide-peach rounded-xl border border-peach bg-blush">
              {[
                ['Bank', contact.bank.name, false],
                ['Account title', contact.bank.title, false],
                ['Account number', contact.bank.accountNumber, true],
                ['IBAN', contact.bank.iban, true],
              ].filter(([, v]) => v).map(([label, value, copy]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <dt className="text-[12.5px] text-graphite">{label}</dt>
                    <dd className={`m-0 break-all font-semibold ${copy ? 'tracking-wide' : ''}`}>{value}</dd>
                  </div>
                  {copy && <CopyButton value={value} label={label} />}
                </div>
              ))}
            </dl>
          ) : (
            <p className="m-0 text-graphite">Contact PearlSolutions for the bank details. They will confirm once your payment is received.</p>
          )}
          {contact.bank && <p className="mt-3 text-[14px] text-graphite">Pay by bank transfer and write <b className="text-night">{shopName}</b> in the transfer reference, so we can match your payment.</p>}
          {contact.email && (
            <p className="mt-3 text-[14px] text-graphite">
              Questions or already paid? Write to <a className="font-medium text-night underline underline-offset-2" href={`mailto:${contact.email}?subject=${encodeURIComponent('Billing')}`}>{contact.email}</a>
            </p>
          )}
          {needsPayment && <p className="mt-3 text-[13px] text-graphite">Your Paid status changes only after PearlSolutions confirms the payment.</p>}
        </Card>
      </div>
    </div>
  );
}
