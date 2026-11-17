// Pure billing rules for PearlSolutions clients. No database or framework code, so it is unit-tested.
import { BILLING_STATUS, PLAN_WARN_DAYS, TRIAL_DAYS } from './constants.mjs';
import { businessDay } from '../orders/dates.mjs';

const startOfUtcDay = (now) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

/** Unpaid and the due date has passed. Paid clients and unpaid clients without a due date are never overdue. */
export function isOverdue({ billingStatus, dueDate }, now = new Date()) {
  if (billingStatus !== BILLING_STATUS.UNPAID || !dueDate) return false;
  return new Date(dueDate).getTime() < startOfUtcDay(now);
}

/** Label + tone for a status pill: 'Paid' | 'Unpaid' | 'Overdue'. */
export function billingLabel(client, now = new Date()) {
  if (client.billingStatus === BILLING_STATUS.PAID) return { label: 'Paid', tone: 'ok' };
  return isOverdue(client, now) ? { label: 'Overdue', tone: 'alert' } : { label: 'Unpaid', tone: 'off' };
}

/**
 * Dashboard numbers. Suspended clients are not billed, so they never count towards
 * revenue or outstanding amounts.
 * client: { isActive, billingStatus, monthlyFee, dueDate }
 */
export function summarizeClients(clients, now = new Date()) {
  const s = { total: clients.length, active: 0, suspended: 0, paid: 0, unpaid: 0, overdue: 0, monthlyRevenue: 0, outstanding: 0 };
  for (const c of clients) {
    if (!c.isActive) { s.suspended += 1; continue; }
    s.active += 1;
    const fee = Number(c.monthlyFee) || 0;
    if (c.billingStatus === BILLING_STATUS.PAID) { s.paid += 1; s.monthlyRevenue += fee; continue; }
    s.unpaid += 1;
    s.outstanding += fee;
    if (isOverdue(c, now)) s.overdue += 1;
  }
  return s;
}

/** Most urgent first: overdue (oldest due date first), then unpaid with a due date, then unpaid without one. */
export function sortByUrgency(clients, now = new Date()) {
  const rank = (c) => (isOverdue(c, now) ? 0 : c.dueDate ? 1 : 2);
  return [...clients].sort((a, b) => rank(a) - rank(b) || (new Date(a.dueDate || 0) - new Date(b.dueDate || 0)));
}

/** "Sip & Chill!" -> "sip-chill". Used for the tenant slug. */
export function slugify(name) {
  const slug = String(name).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return slug || 'client';
}

/** First of base, base-2, base-3... that is not in `taken`. */
export function pickFreeSlug(base, taken) {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; ; i += 1) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** Due date of a new signup's trial: UTC midnight, `days` after today (dates are stored as UTC midnight). */
export const trialEndDate = (now, days) => new Date(startOfUtcDay(now) + days * 864e5);

const DAY = 864e5;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * What a client OWNER sees about their plan. Derived only from fields PearlSolutions already sets
 * (billingStatus, dueDate, lastPaidAt, monthlyFee), so it can never disagree with the admin screen.
 *
 *   TRIAL        never paid, first due date still ahead  -> "Free trial: N days left"
 *   TRIAL_ENDED  never paid, first due date has passed
 *   ACTIVE       marked Paid
 *   UPCOMING     paid before, unpaid now, due date far away
 *   DUE_SOON     paid before, due within PLAN_WARN_DAYS
 *   OVERDUE      paid before, due date has passed
 *   SETUP        no due date set yet
 *
 * tone: ok | neutral | warn | alert. needsAttention drives the reminder banner.
 * "Today" is the shop's business day (Pakistan time), the same calendar the due date is entered in.
 */
export function planStatus(tenant, now = new Date()) {
  const fee = Number(tenant.monthlyFee) || 0;
  const paid = tenant.billingStatus === BILLING_STATUS.PAID;
  const everPaid = paid || Boolean(tenant.lastPaidAt);
  const today = businessDay(now).getTime();
  const due = tenant.dueDate ? new Date(tenant.dueDate).getTime() : null;
  const daysLeft = due === null ? null : Math.round((due - today) / DAY); // negative = days overdue
  const base = { fee, dueDate: tenant.dueDate ?? null, lastPaidAt: tenant.lastPaidAt ?? null, daysLeft, trialDays: null, trialElapsed: null, trialProgress: null };
  const out = (state, tone, headline, needsAttention = false, extra = {}) => ({ ...base, state, tone, headline, needsAttention, ...extra });

  if (paid) return out('ACTIVE', 'ok', 'Plan active');
  if (due === null) return out('SETUP', 'neutral', everPaid ? 'Payment due' : 'Your plan is being set up');

  if (!everPaid) {
    if (daysLeft < 0) return out('TRIAL_ENDED', 'alert', 'Free trial ended: first payment is overdue', true);
    const trialDays = Math.max(TRIAL_DAYS, daysLeft);
    const trialElapsed = trialDays - daysLeft;
    const trial = { trialDays, trialElapsed, trialProgress: trialElapsed / trialDays };
    const headline = daysLeft === 0 ? 'Free trial ends today' : `Free trial: ${plural(daysLeft, 'day')} left`;
    return out('TRIAL', daysLeft <= PLAN_WARN_DAYS ? 'warn' : 'ok', headline, daysLeft <= PLAN_WARN_DAYS, trial);
  }

  if (daysLeft < 0) return out('OVERDUE', 'alert', `Payment overdue by ${plural(-daysLeft, 'day')}`, true);
  if (daysLeft <= PLAN_WARN_DAYS) return out('DUE_SOON', 'warn', daysLeft === 0 ? 'Payment due today' : `Payment due in ${plural(daysLeft, 'day')}`, true);
  return out('UPCOMING', 'neutral', 'Next payment coming up');
}
