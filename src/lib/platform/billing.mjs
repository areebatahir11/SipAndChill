// Pure billing rules for PearlSolutions clients. No database or framework code, so it is unit-tested.
import { BILLING_STATUS } from './constants.mjs';

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
