import test from 'node:test';
import assert from 'node:assert/strict';
import { isOverdue, billingLabel, summarizeClients, sortByUrgency, slugify, pickFreeSlug, trialEndDate } from '../src/lib/platform/billing.mjs';
import { generatePassword } from '../src/lib/platform/password-generator.mjs';

const NOW = new Date('2026-11-04T10:00:00Z');
const client = (o) => ({ isActive: true, billingStatus: 'UNPAID', monthlyFee: 0, dueDate: null, ...o });

test('isOverdue: only unpaid clients whose due date is before today', () => {
  assert.equal(isOverdue(client({ dueDate: '2026-11-03' }), NOW), true);
  assert.equal(isOverdue(client({ dueDate: '2026-11-04' }), NOW), false); // due today is not overdue yet
  assert.equal(isOverdue(client({ dueDate: '2026-11-10' }), NOW), false);
  assert.equal(isOverdue(client({ dueDate: null }), NOW), false);
  assert.equal(isOverdue(client({ billingStatus: 'PAID', dueDate: '2026-01-01' }), NOW), false);
});

test('billingLabel: Paid / Unpaid / Overdue', () => {
  assert.deepEqual(billingLabel(client({ billingStatus: 'PAID' }), NOW), { label: 'Paid', tone: 'ok' });
  assert.deepEqual(billingLabel(client({}), NOW), { label: 'Unpaid', tone: 'off' });
  assert.deepEqual(billingLabel(client({ dueDate: '2026-10-01' }), NOW), { label: 'Overdue', tone: 'alert' });
});

test('summarizeClients: suspended clients never count towards revenue or outstanding', () => {
  const s = summarizeClients([
    client({ billingStatus: 'PAID', monthlyFee: 5000 }),
    client({ billingStatus: 'PAID', monthlyFee: 3000, isActive: false }),
    client({ monthlyFee: 4000, dueDate: '2026-10-30' }),
    client({ monthlyFee: 2500 }),
  ], NOW);
  assert.deepEqual(s, { total: 4, active: 3, suspended: 1, paid: 1, unpaid: 2, overdue: 1, monthlyRevenue: 5000, outstanding: 6500 });
});

test('summarizeClients: empty list', () => {
  assert.deepEqual(summarizeClients([], NOW), { total: 0, active: 0, suspended: 0, paid: 0, unpaid: 0, overdue: 0, monthlyRevenue: 0, outstanding: 0 });
});

test('sortByUrgency: overdue first (oldest due first), then dated, then undated', () => {
  const a = client({ id: 'undated' });
  const b = client({ id: 'later', dueDate: '2026-12-01' });
  const c = client({ id: 'old-overdue', dueDate: '2026-09-01' });
  const d = client({ id: 'new-overdue', dueDate: '2026-10-20' });
  assert.deepEqual(sortByUrgency([a, b, d, c], NOW).map((x) => x.id), ['old-overdue', 'new-overdue', 'later', 'undated']);
});

test('slugify and pickFreeSlug', () => {
  assert.equal(slugify('Sip & Chill!'), 'sip-chill');
  assert.equal(slugify('  Café   Nº 1 '), 'cafe-no-1');
  assert.equal(slugify('Cafés'), 'cafes'); // accents are dropped, not turned into a dash
  assert.equal(slugify('!!!'), 'client');
  assert.ok(slugify('x'.repeat(100)).length <= 40);
  assert.equal(pickFreeSlug('sip-chill', []), 'sip-chill');
  assert.equal(pickFreeSlug('sip-chill', ['sip-chill']), 'sip-chill-2');
  assert.equal(pickFreeSlug('sip-chill', ['sip-chill', 'sip-chill-2', 'sip-chill-3']), 'sip-chill-4');
});

test('generatePassword: right length, letter + digit, no ambiguous characters, varies', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) {
    const p = generatePassword();
    assert.equal(p.length, 14);
    assert.match(p, /[A-Za-z]/);
    assert.match(p, /\d/);
    assert.doesNotMatch(p, /[0OIl1]/);
    seen.add(p);
  }
  assert.equal(seen.size, 200);
});

test('trialEndDate: UTC midnight, N days after the signup day', () => {
  assert.equal(trialEndDate(new Date('2026-11-05T22:30:00Z'), 14).toISOString(), '2026-11-19T00:00:00.000Z');
  assert.equal(trialEndDate(new Date('2026-12-25T01:00:00Z'), 14).toISOString(), '2027-01-08T00:00:00.000Z');
});
