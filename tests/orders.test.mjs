import test from 'node:test';
import assert from 'node:assert/strict';
import { toMinor, fromMinor, calcOrder, calcPayment, paymentStatus } from '../src/lib/money.mjs';
import { consumption, maxServings, mergeLines, toMilli } from '../src/lib/orders/recipe.mjs';
import { resolveRange, bucketFor, localDateString, businessDay, parseBusinessDay } from '../src/lib/orders/dates.mjs';
import { buildReceipt, normalizeWidth } from '../src/lib/orders/receipt.mjs';

// ---------- money ----------
test('toMinor/fromMinor are exact (no float drift)', () => {
  assert.equal(toMinor('0.10') + toMinor('0.20'), toMinor('0.30'));
  assert.equal(toMinor(12.35), 1235);
  assert.equal(toMinor('19.9'), 1990);
  assert.equal(fromMinor(5), '0.05');
  assert.equal(fromMinor(123456), '1234.56');
});
test('toMinor rejects junk, negatives and 3 decimals', () => {
  for (const bad of ['', 'abc', '-5', '1.234', '1e3', null, undefined, '1,000']) assert.throws(() => toMinor(bad), RangeError, String(bad));
});
test('order totals: line total, subtotal, final total', () => {
  const o = calcOrder([{ unitPriceMinor: 35000, quantity: 2 }, { unitPriceMinor: 15050, quantity: 3 }]);
  assert.deepEqual(o.items.map((i) => i.lineTotalMinor), [70000, 45150]);
  assert.equal(o.subtotalMinor, 115150);
  assert.equal(o.totalMinor, 115150);
});
test('order totals: discount reduces total; invalid quantity/discount rejected', () => {
  assert.equal(calcOrder([{ unitPriceMinor: 10000, quantity: 2 }], 2500).totalMinor, 17500);
  assert.throws(() => calcOrder([{ unitPriceMinor: 100, quantity: 0 }]));
  assert.throws(() => calcOrder([{ unitPriceMinor: 100, quantity: 1.5 }]));
  assert.throws(() => calcOrder([{ unitPriceMinor: 100, quantity: 1 }], 101));
});

// ---------- payments ----------
test('exact payment -> PAID, no change', () => {
  const p = calcPayment(85000, 0, 85000);
  assert.deepEqual(p, { appliedMinor: 85000, changeMinor: 0, paidMinor: 85000, outstandingMinor: 0, status: 'PAID' });
});
test('spec example: total 850, received 1000 -> change 150', () => {
  const p = calcPayment(toMinor(850), 0, toMinor(1000));
  assert.equal(p.changeMinor, toMinor(150));
  assert.equal(p.appliedMinor, toMinor(850));
  assert.equal(p.status, 'PAID');
});
test('partial payment -> PARTIAL, outstanding shown, change is 0 (never negative)', () => {
  const p = calcPayment(85000, 0, 30000);
  assert.equal(p.status, 'PARTIAL');
  assert.equal(p.outstandingMinor, 55000);
  assert.equal(p.changeMinor, 0);
  assert.equal(p.paidMinor, 30000);
});
test('nothing received -> UNPAID', () => {
  const p = calcPayment(85000, 0, 0);
  assert.equal(p.status, 'UNPAID');
  assert.equal(p.outstandingMinor, 85000);
});
test('second payment settles the rest and returns change on the excess only', () => {
  const p = calcPayment(85000, 30000, 100000);
  assert.equal(p.appliedMinor, 55000);
  assert.equal(p.changeMinor, 45000);
  assert.equal(p.paidMinor, 85000);
  assert.equal(p.status, 'PAID');
});
test('collected revenue never exceeds the order total', () => {
  for (const [t, a, r] of [[100, 0, 10_000], [100, 99, 5], [0, 0, 0], [5000, 5000, 100]]) {
    const p = calcPayment(t, a, r);
    assert.ok(p.paidMinor <= Math.max(t, a));
    assert.equal(p.appliedMinor + p.changeMinor, r);
  }
});
test('zero-value order is PAID', () => assert.equal(paymentStatus(0, 0), 'PAID'));

// ---------- recipes ----------
const recipes = new Map([
  ['mango', [{ ingredientId: 'pulp', quantityMilli: toMilli(0.15) }, { ingredientId: 'milk', quantityMilli: toMilli(0.2) }, { ingredientId: 'sugar', quantityMilli: toMilli(0.02) }]],
  ['lassi', [{ ingredientId: 'milk', quantityMilli: toMilli(0.25) }]],
]);
test('recipe consumption multiplies by quantity and sums shared ingredients', () => {
  const n = consumption([{ productId: 'mango', quantity: 3 }, { productId: 'lassi', quantity: 2 }], recipes);
  assert.equal(n.get('pulp'), 450);
  assert.equal(n.get('milk'), 600 + 500);
  assert.equal(n.get('sugar'), 60);
});
test('product without a recipe consumes nothing', () => assert.equal(consumption([{ productId: 'water', quantity: 5 }], recipes).size, 0));
test('milli-units avoid float error (0.1 x 3)', () => assert.equal(toMilli(0.1) * 3, 300));
test('maxServings = limiting ingredient; null without recipe', () => {
  const stock = new Map([['pulp', 1000], ['milk', 5000], ['sugar', 10000]]);
  assert.equal(maxServings(recipes.get('mango'), stock), 6);
  assert.equal(maxServings([], stock), null);
  assert.equal(maxServings(recipes.get('mango'), new Map()), 0);
});
test('mergeLines combines duplicate products', () => {
  assert.deepEqual(mergeLines([{ productId: 'a', quantity: 1 }, { productId: 'b', quantity: 2 }, { productId: 'a', quantity: 3 }]), [{ productId: 'a', quantity: 4 }, { productId: 'b', quantity: 2 }]);
});

// ---------- date ranges (Pakistan time, UTC+5) ----------
const NOW = new Date('2026-11-04T20:30:00Z'); // = 2026-11-05 01:30 in Karachi
test('today uses the Karachi business day, not UTC', () => {
  const r = resolveRange('today', {}, NOW);
  assert.equal(r.start.toISOString(), '2026-11-04T19:00:00.000Z');
  assert.equal(r.end.toISOString(), '2026-11-05T19:00:00.000Z');
  assert.equal(localDateString(NOW), '2026-11-05');
});
test('yesterday, last7, last30 lengths and boundaries', () => {
  const y = resolveRange('yesterday', {}, NOW);
  assert.equal(y.end.getTime(), resolveRange('today', {}, NOW).start.getTime());
  assert.equal(resolveRange('last7', {}, NOW).days, 7);
  assert.equal(resolveRange('last30', {}, NOW).days, 30);
  assert.equal(resolveRange('last7', {}, NOW).end.getTime(), resolveRange('today', {}, NOW).end.getTime());
});
test('this month / previous month', () => {
  const t = resolveRange('thisMonth', {}, NOW);
  assert.equal(t.start.toISOString(), '2026-10-31T19:00:00.000Z'); // Nov 1 00:00 Karachi
  const p = resolveRange('prevMonth', {}, NOW);
  assert.equal(p.end.getTime(), t.start.getTime());
  assert.equal(p.days, 31); // October has 31 days: Oct 1 00:00 PKT -> Nov 1 00:00 PKT
});
test('previous month wraps the year in January', () => {
  const r = resolveRange('prevMonth', {}, new Date('2027-01-10T06:00:00Z'));
  assert.equal(r.start.toISOString(), '2026-11-30T19:00:00.000Z');
  assert.equal(r.days, 31);
});
test('custom range is inclusive; comparison window is same length right before', () => {
  const r = resolveRange('custom', { from: '2026-10-01', to: '2026-10-10' }, NOW);
  assert.equal(r.days, 10);
  assert.equal(r.prevEnd.getTime(), r.start.getTime());
  assert.equal(r.prevEnd.getTime() - r.prevStart.getTime(), r.end.getTime() - r.start.getTime());
});
test('custom range validation', () => {
  assert.throws(() => resolveRange('custom', { from: '2026-10-10', to: '2026-10-01' }, NOW), RangeError);
  assert.throws(() => resolveRange('custom', { from: '2026-02-31', to: '2026-03-01' }, NOW), RangeError);
  assert.throws(() => resolveRange('custom', {}, NOW), RangeError);
  assert.throws(() => resolveRange('custom', { from: '2024-01-01', to: '2026-01-01' }, NOW), RangeError);
});
test('unknown preset falls back to today; buckets scale with range', () => {
  assert.equal(resolveRange('nonsense', {}, NOW).preset, 'today');
  assert.equal(bucketFor(1), 'hour'); assert.equal(bucketFor(7), 'day'); assert.equal(bucketFor(90), 'week'); assert.equal(bucketFor(300), 'month');
});

// ---------- receipt ----------
const order = {
  orderNo: 42, createdAt: '2026-11-04T10:00:00Z', cashierName: 'Ali', status: 'COMPLETED', paymentStatus: 'PAID',
  subtotal: '850.00', discount: '0.00', total: '850.00', amountPaid: '850.00',
  items: [{ name: 'Mango Shake', quantity: 2, unitPrice: '350.00', lineTotal: '700.00' }, { name: 'Lemonade', quantity: 1, unitPrice: '150.00', lineTotal: '150.00' }],
  payments: [{ amountReceived: '1000.00', changeReturned: '150.00' }],
};
const settings = { businessName: 'Sip & Chill', phone: '0300', address: null, receiptFooter: 'Thanks', currency: 'Rs' };
test('receipt carries order, payment and change correctly', () => {
  const r = buildReceipt(order, settings);
  assert.equal(r.orderNo, 42);
  assert.equal(r.total, 'Rs 850'); assert.equal(r.received, 'Rs 1,000'); assert.equal(r.change, 'Rs 150');
  assert.equal(r.hasOutstanding, false); assert.equal(r.discount, null);
  assert.equal(r.lines[0].lineTotal, 'Rs 700');
});
test('receipt for a partial payment shows outstanding, not negative change', () => {
  const r = buildReceipt({ ...order, paymentStatus: 'PARTIAL', amountPaid: '300.00', payments: [{ amountReceived: '300.00', changeReturned: '0.00' }] }, settings);
  assert.equal(r.change, 'Rs 0'); assert.equal(r.outstanding, 'Rs 550'); assert.equal(r.hasOutstanding, true);
});
test('receipt width accepts only 58 or 80', () => {
  assert.equal(normalizeWidth('58'), 58); assert.equal(normalizeWidth(80), 80); assert.equal(normalizeWidth('70'), 80); assert.equal(normalizeWidth(undefined), 80);
});

// ---------- per-day order numbers ----------
test('business day follows Pakistan time, so #1 restarts at local midnight (not UTC midnight)', () => {
  // 2026-11-09 18:59 UTC = 23:59 in Karachi -> still the 9th; one minute later it is the 10th.
  assert.equal(businessDay(new Date('2026-11-09T18:59:00Z')).toISOString(), '2026-11-09T00:00:00.000Z');
  assert.equal(businessDay(new Date('2026-11-09T19:00:00Z')).toISOString(), '2026-11-10T00:00:00.000Z');
  assert.equal(businessDay(new Date('2026-11-09T23:38:00+05:00')).toISOString().slice(0, 10), '2026-11-09');
});
test('parseBusinessDay accepts real dates only', () => {
  assert.equal(parseBusinessDay('2026-11-10').toISOString().slice(0, 10), '2026-11-10');
  assert.equal(parseBusinessDay('2026-02-31'), null);
  assert.equal(parseBusinessDay('nope'), null);
});
