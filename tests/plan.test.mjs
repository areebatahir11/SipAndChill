import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planStatus } from '../src/lib/platform/billing.mjs';
import { PERMISSIONS, ROLE_DEFAULTS, ROLE_CODES, ROUTE_ACCESS, hasPermission, canSeeBillingNotice } from '../src/lib/permissions/codes.mjs';

const NOW = new Date('2026-11-17T04:41:00Z'); // 09:41 in Karachi
const t = (o) => ({ billingStatus: 'UNPAID', monthlyFee: 3000, dueDate: null, lastPaidAt: null, ...o });

test('never paid + due date ahead = free trial with a countdown and progress', () => {
  const p = planStatus(t({ dueDate: '2026-11-24T00:00:00Z' }), NOW);
  assert.equal(p.state, 'TRIAL');
  assert.equal(p.daysLeft, 7);
  assert.equal(p.headline, 'Free trial: 7 days left');
  assert.equal(p.trialDays, 14);
  assert.equal(p.trialProgress, 0.5);
  assert.equal(p.needsAttention, false);
  assert.equal(p.fee, 3000);
});

test('trial: reminder only in the last days, singular wording, ends today', () => {
  assert.equal(planStatus(t({ dueDate: '2026-11-22T00:00:00Z' }), NOW).needsAttention, true); // 5 days
  assert.equal(planStatus(t({ dueDate: '2026-11-18T00:00:00Z' }), NOW).headline, 'Free trial: 1 day left');
  assert.equal(planStatus(t({ dueDate: '2026-11-17T00:00:00Z' }), NOW).headline, 'Free trial ends today');
});

test('trial ended without payment is an alert', () => {
  const p = planStatus(t({ dueDate: '2026-11-15T00:00:00Z' }), NOW);
  assert.equal(p.state, 'TRIAL_ENDED');
  assert.equal(p.tone, 'alert');
  assert.equal(p.needsAttention, true);
});

test('a trial longer than 14 days (admin set a later date) keeps the true length', () => {
  const p = planStatus(t({ dueDate: '2026-12-17T00:00:00Z' }), NOW);
  assert.equal(p.trialDays, 30);
  assert.equal(p.trialElapsed, 0);
});

test('paid, paid-before-and-due-soon, overdue, upcoming, no date', () => {
  assert.equal(planStatus(t({ billingStatus: 'PAID', dueDate: '2026-12-17T00:00:00Z', lastPaidAt: '2026-11-10' }), NOW).state, 'ACTIVE');
  assert.equal(planStatus(t({ lastPaidAt: '2026-10-17', dueDate: '2026-11-19T00:00:00Z' }), NOW).state, 'DUE_SOON');
  assert.equal(planStatus(t({ lastPaidAt: '2026-10-17', dueDate: '2026-11-10T00:00:00Z' }), NOW).headline, 'Payment overdue by 7 days');
  assert.equal(planStatus(t({ lastPaidAt: '2026-10-17', dueDate: '2026-12-17T00:00:00Z' }), NOW).state, 'UPCOMING');
  assert.equal(planStatus(t({}), NOW).state, 'SETUP');
});

test('"today" is the Karachi business day: 01:00 PKT on the 18th is still the 17th in UTC', () => {
  const lateNight = new Date('2026-11-17T20:00:00Z'); // 01:00 on 18 Nov in Karachi
  assert.equal(planStatus(t({ dueDate: '2026-11-18T00:00:00Z' }), lateNight).headline, 'Free trial ends today');
});

test('only the Business Owner has Plan & Billing (managers/staff never see the fee)', () => {
  const route = ROUTE_ACCESS.find((r) => r.href === '/billing');
  assert.ok(route && route.label && route.hint);
  for (const role of Object.values(ROLE_CODES)) {
    assert.equal(hasPermission(ROLE_DEFAULTS[role].permissions, route.any), role === ROLE_CODES.OWNER, role);
  }
  assert.deepEqual(route.any, [PERMISSIONS.SETTINGS_MANAGE]);
});

test('the client-facing plan query never selects the internal note', () => {
  const src = readFileSync(new URL('../src/modules/billing/service.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /internalNote/);
  assert.match(src, /select:/);
});

test('the billing reminder banner is for Owner and Manager only; cashier and inventory staff never see it', () => {
  const sees = (role) => canSeeBillingNotice(ROLE_DEFAULTS[role].permissions);
  assert.equal(sees(ROLE_CODES.OWNER), true);
  assert.equal(sees(ROLE_CODES.MANAGER), true);
  assert.equal(sees(ROLE_CODES.CASHIER), false);
  assert.equal(sees(ROLE_CODES.INVENTORY_STAFF), false);
});

test('a manager never receives the amount: the banner only shows the sentence with money to the owner', () => {
  const src = readFileSync(new URL('../src/features/billing/PlanBanner.js', import.meta.url), 'utf8');
  assert.match(src, /isOwner \? planSentence\(plan\)/);
  const layout = readFileSync(new URL('../src/app/(dashboard)/layout.js', import.meta.url), 'utf8');
  assert.match(layout, /plan: isOwner && plan \? plain\(plan\) : null/); // sidebar/context data is owner-only
});

test('manager notice texts are the agreed wording and never mention an amount', () => {
  const src = readFileSync(new URL('../src/features/billing/plan-ui.js', import.meta.url), 'utf8');
  const m = src.slice(src.indexOf('export function managerNotice'));
  for (const line of ['Trial ending soon', 'Your trial has ended', 'Subscription renewal', 'Payment overdue', 'awaiting subscription activation']) assert.ok(m.includes(line), line);
  assert.doesNotMatch(m, /plan\.fee|money\(/);
});
