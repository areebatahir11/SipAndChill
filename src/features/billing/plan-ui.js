import { dateOnly, money } from '@/lib/format';

/** Plain-words sentence about what happens next, shared by the sidebar chip, the banner and the billing page. */
export function planSentence(plan) {
  const fee = plan.fee > 0 ? `${money(plan.fee, plan.currency)} per month` : null;
  const due = plan.dueDate ? dateOnly(plan.dueDate) : null;
  switch (plan.state) {
    case 'TRIAL':
      return fee ? `Then ${fee} from ${due}.` : `Your trial ends on ${due}.`;
    case 'TRIAL_ENDED':
      return `Your free trial ended on ${due}.${fee ? ` Please pay ${money(plan.fee, plan.currency)} to keep using the software.` : ''}`;
    case 'OVERDUE':
      return `${fee ? `${money(plan.fee, plan.currency)} was ` : 'Payment was '}due on ${due}. Please pay to avoid interruption.`;
    case 'DUE_SOON':
      return `${fee ? `${money(plan.fee, plan.currency)} is ` : 'Payment is '}due on ${due}.`;
    case 'UPCOMING':
      return `${fee ? `${money(plan.fee, plan.currency)} is ` : 'Payment is '}due on ${due}.`;
    case 'ACTIVE':
      return `${fee ? `${money(plan.fee, plan.currency)} per month. ` : ''}${due ? `Next payment on ${due}.` : 'Thank you for your payment.'}`;
    default:
      return 'PearlSolutions will confirm your first payment date soon.';
  }
}

const days = (n) => `${n} day${n === 1 ? '' : 's'}`;

/** What a Manager sees: { headline, text }. No amounts and no link; wording is fixed by PearlSolutions. */
export function managerNotice(plan) {
  const due = plan.dueDate ? dateOnly(plan.dueDate) : null;
  const left = plan.daysLeft === 0 ? 'ends today' : `${days(plan.daysLeft)} left`;
  switch (plan.state) {
    case 'TRIAL':
      return {
        headline: `Trial ending soon · ${left}`,
        text: `Your shop's free trial ends on ${due}. The next step is to activate your subscription to keep everything running smoothly.`,
      };
    case 'TRIAL_ENDED':
      return {
        headline: 'Your trial has ended',
        text: 'Your shop is currently awaiting subscription activation. Complete the first payment to continue enjoying uninterrupted access.',
      };
    case 'OVERDUE':
      return {
        headline: `Payment overdue · ${days(-plan.daysLeft)}`,
        text: `Your subscription payment was due on ${due}. Complete the outstanding payment to avoid any interruption to your shop's services.`,
      };
    default:
      return {
        headline: `Subscription renewal · ${plan.daysLeft === 0 ? 'due today' : `${days(plan.daysLeft)} left`}`,
        text: `Your next payment is due on ${due}. Renew before the due date to keep your shop running without interruption.`,
      };
  }
}
