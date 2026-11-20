import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  USAGE_AUDIT_ACTIONS, USAGE_FEATURES, activityStatus, buildUsageReport, fillDays, parseUsageDays, usageWindow,
} from '../src/lib/platform/usage.mjs';

const NOW = new Date('2026-11-20T11:00:00Z'); // 16:00 in Pakistan

test('parseUsageDays accepts only the offered ranges', () => {
  assert.equal(parseUsageDays('7'), 7);
  assert.equal(parseUsageDays('90'), 90);
  for (const bad of [null, undefined, '', 'abc', '0', '-7', '365', '30; DROP TABLE']) assert.equal(parseUsageDays(bad), 30);
});

test('usageWindow covers the last N Pakistan days ending with today', () => {
  const w = usageWindow(7, NOW);
  assert.equal(w.to, '2026-11-20');
  assert.equal(w.from, '2026-11-14');
  assert.equal(w.start.toISOString(), '2026-11-13T19:00:00.000Z'); // 14 Nov 00:00 PKT
  assert.equal(w.end.toISOString(), '2026-11-20T19:00:00.000Z'); // 21 Nov 00:00 PKT
});

test('usageWindow uses the Pakistan date even when UTC is still the day before', () => {
  const w = usageWindow(1, new Date('2026-11-20T21:30:00Z')); // 21 Nov 02:30 PKT
  assert.equal(w.to, '2026-11-21');
  assert.equal(w.from, '2026-11-21');
});

test('fillDays returns every day with zeros for quiet days', () => {
  const out = fillDays('2026-11-18', 4, [{ day: '2026-11-19', logins: 3, orders: 9 }]);
  assert.deepEqual(out, [
    { day: '2026-11-18', logins: 0, orders: 0 },
    { day: '2026-11-19', logins: 3, orders: 9 },
    { day: '2026-11-20', logins: 0, orders: 0 },
    { day: '2026-11-21', logins: 0, orders: 0 },
  ]);
});

test('activityStatus thresholds', () => {
  const ago = (d) => new Date(NOW.getTime() - d * 864e5);
  assert.equal(activityStatus(null, NOW).code, 'NEVER');
  assert.equal(activityStatus(ago(0), NOW).code, 'ACTIVE');
  assert.equal(activityStatus(ago(7), NOW).code, 'ACTIVE');
  assert.equal(activityStatus(ago(8), NOW).code, 'QUIET');
  assert.equal(activityStatus(ago(30), NOW).code, 'QUIET');
  assert.equal(activityStatus(ago(31), NOW).code, 'INACTIVE');
  assert.equal(activityStatus(new Date(NOW.getTime() + 5000), NOW).code, 'ACTIVE'); // clock skew never breaks it
});

const window = usageWindow(30, NOW);
const tenants = [
  { id: 'a', name: 'Alpha Juice', slug: 'alpha', businessType: 'JUICE_SHOP', createdAt: new Date('2026-10-01') },
  { id: 'b', name: 'Beta Cafe', slug: 'beta', businessType: 'COFFEE_SHOP', createdAt: new Date('2026-10-02') },
  { id: 'c', name: 'Gamma Shake', slug: 'gamma', businessType: 'JUICE_SHOP', createdAt: new Date('2026-10-03') },
];
const rows = {
  tenants, window,
  actionRows: [
    { tenantId: 'a', action: 'auth.login', count: 12, lastAt: new Date('2026-11-20T05:00:00Z') },
    { tenantId: 'a', action: 'order.created', count: 100, lastAt: new Date('2026-11-20T09:00:00Z') },
    { tenantId: 'a', action: 'order.cancelled', count: 4, lastAt: new Date('2026-11-19T09:00:00Z') },
    { tenantId: 'a', action: 'expense.created', count: 10, lastAt: new Date('2026-11-18T09:00:00Z') },
    { tenantId: 'b', action: 'auth.login', count: 2, lastAt: new Date('2026-11-05T05:00:00Z') },
    { tenantId: 'b', action: 'order.created', count: 5, lastAt: new Date('2026-11-05T06:00:00Z') },
    // PearlSolutions' own actions and unknown ones must never count as client usage
    { tenantId: 'b', action: 'platform.client_updated', count: 50, lastAt: new Date('2026-11-20T10:00:00Z') },
    { tenantId: 'b', action: 'menu.imported', count: 9, lastAt: new Date('2026-11-20T10:00:00Z') },
  ],
  orderRows: [{ tenantId: 'a', printed: 90, discounted: 7 }],
  paymentRows: [{ tenantId: 'a', online: 30 }],
  members: [
    { tenantId: 'a', active: true, lastLoginAt: new Date('2026-11-20T05:00:00Z') },
    { tenantId: 'a', active: true, lastLoginAt: new Date('2026-09-01T05:00:00Z') }, // before the window
    { tenantId: 'a', active: false, lastLoginAt: null },
    { tenantId: 'b', active: true, lastLoginAt: new Date('2026-11-05T05:00:00Z') },
    { tenantId: 'c', active: true, lastLoginAt: null },
  ],
  daily: [{ day: '2026-11-20', logins: 3, orders: 20 }],
};

test('buildUsageReport: per-client numbers', () => {
  const r = buildUsageReport(rows, NOW);
  const [a, b, c] = r.clients;
  assert.deepEqual([a.id, b.id, c.id], ['a', 'b', 'c']); // most active first
  assert.equal(a.logins, 12);
  assert.equal(a.users, 2); // the deactivated login is not counted
  assert.equal(a.activeUsers, 1); // only one signed in inside the window
  assert.equal(a.orders, 100);
  assert.equal(a.features.orderCare, 4);
  assert.equal(a.features.printing, 90);
  assert.equal(a.features.discounts, 7);
  assert.equal(a.features.onlinePay, 30);
  assert.equal(a.actions, 100 + 4 + 90 + 30 + 7 + 10);
  assert.equal(a.topFeature.key, 'orders');
  assert.equal(a.activity.code, 'ACTIVE');
  assert.equal(b.activity.code, 'QUIET'); // last seen 15 days ago
  assert.equal(c.activity.code, 'NEVER');
  assert.equal(c.topFeature, null);
  assert.equal(c.actions, 0);
});

test('buildUsageReport: platform actions never count as client usage', () => {
  const b = buildUsageReport(rows, NOW).clients.find((c) => c.id === 'b');
  assert.equal(b.actions, 5);
  assert.equal(b.lastActiveAt.toISOString(), '2026-11-05T06:00:00.000Z');
});

test('buildUsageReport: totals, feature ranking and silent clients', () => {
  const r = buildUsageReport(rows, NOW);
  assert.deepEqual(r.totals, { clients: 3, loggedIn: 2, silent: 1, logins: 14, activeUsers: 2, orders: 105, actions: 246 });
  assert.equal(r.features[0].key, 'orders');
  assert.deepEqual([r.features[0].count, r.features[0].clients, r.features[0].adoption], [105, 2, 67]);
  assert.equal(r.features.find((f) => f.key === 'team').count, 0);
  assert.equal(r.features.length, USAGE_FEATURES.length);
  assert.equal(r.daily.length, 30);
  assert.equal(r.daily.at(-1).orders, 20);
  assert.deepEqual(r.range, { days: 30, from: '2026-10-22', to: '2026-11-20' });
});

test('buildUsageReport with no data at all does not divide by zero', () => {
  const r = buildUsageReport({ tenants: [], window, actionRows: [], members: [], daily: [] }, NOW);
  assert.equal(r.totals.clients, 0);
  assert.ok(r.features.every((f) => f.adoption === 0));
});

test('only whitelisted audit actions are ever read', () => {
  assert.ok(USAGE_AUDIT_ACTIONS.includes('auth.login'));
  assert.ok(!USAGE_AUDIT_ACTIONS.some((a) => a.startsWith('platform.') || a === 'menu.imported' || a === 'auth.locked'));
  assert.equal(new Set(USAGE_AUDIT_ACTIONS).size, USAGE_AUDIT_ACTIONS.length);
});

// Guards on the promises made in the code: platform-admin only, counts only.
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');

test('usage API routes are platform-admin only', () => {
  for (const p of ['../src/app/api/platform/usage/route.js', '../src/app/api/platform/clients/[id]/usage/route.js']) {
    const src = read(p);
    assert.match(src, /requirePlatformApi\(request\)/);
    assert.doesNotMatch(src, /requireApi\(/);
    assert.match(src, /handle\(/);
  }
});

test('usage queries never read money, names or audit metadata', () => {
  const src = stripComments(read('../src/modules/platform/usage.js'));
  assert.doesNotMatch(src, /\b(metadata|amount|amountApplied|amountReceived|total|subtotal|price|unitPrice|lineTotal|note|cashierName|email)\b/);
});
