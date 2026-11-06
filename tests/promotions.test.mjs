import test from 'node:test';
import assert from 'node:assert/strict';
import { activePromotion, currentOrUpcoming, isRunning, orderDiscountMinor, salePriceMinor, unitDiscountMinor, withWindow, PROMOTIONS } from '../src/lib/promotions/promotions.mjs';
import { calcOrder } from '../src/lib/money.mjs';
import { buildReceipt } from '../src/lib/orders/receipt.mjs';

// Karachi (UTC+5) local time -> instant
const pk = (s) => new Date(`${s}+05:00`);

test('20% off runs from 6 Nov 00:00 to 8 Nov 23:59:59 Karachi time, inclusive of all 3 days', () => {
  assert.equal(activePromotion(pk('2026-11-05T23:59:59')), null);
  assert.equal(activePromotion(pk('2026-11-06T00:00:00'))?.percent, 20);
  assert.equal(activePromotion(pk('2026-11-07T13:00:00'))?.percent, 20);
  assert.equal(activePromotion(pk('2026-11-08T23:59:59'))?.percent, 20);
  assert.equal(activePromotion(pk('2026-11-09T00:00:00')), null);
});
test('window is exactly 3 days', () => {
  const w = withWindow(PROMOTIONS[0]);
  assert.equal((new Date(w.endsAt) - new Date(w.startsAt)) / 864e5, 3);
});
test('currentOrUpcoming: upcoming before, running during, nothing after', () => {
  assert.equal(currentOrUpcoming(pk('2026-11-01T10:00:00'))?.id, PROMOTIONS[0].id);
  assert.equal(isRunning(currentOrUpcoming(pk('2026-11-01T10:00:00')), pk('2026-11-01T10:00:00')), false);
  assert.equal(isRunning(currentOrUpcoming(pk('2026-11-07T10:00:00')), pk('2026-11-07T10:00:00')), true);
  assert.equal(currentOrUpcoming(pk('2026-11-10T10:00:00')), null);
});
test('sale price: exact integer paisa maths, half-up rounding', () => {
  assert.equal(salePriceMinor(100000, 20), 80000);   // Rs 1000 -> 800
  assert.equal(salePriceMinor(35000, 20), 28000);    // Rs 350 -> 280
  assert.equal(unitDiscountMinor(1005, 20), 201);    // 201.0
  assert.equal(unitDiscountMinor(1003, 20), 201);    // 200.6 -> 201
  assert.equal(unitDiscountMinor(1002, 20), 200);    // 200.4 -> 200
  assert.equal(salePriceMinor(99, 0), 99);
});
test('order discount = sum of per-unit discounts, so shown price x qty equals what is charged', () => {
  const lines = [{ unitPriceMinor: 35000, quantity: 2 }, { unitPriceMinor: 15050, quantity: 3 }];
  const d = orderDiscountMinor(lines, 20);
  const o = calcOrder(lines, d);
  assert.equal(o.subtotalMinor, 115150);
  assert.equal(d, 14000 + 3 * 3010);
  assert.equal(o.totalMinor, 2 * salePriceMinor(35000, 20) + 3 * salePriceMinor(15050, 20));
  assert.equal(orderDiscountMinor(lines, 0), 0);
});
test('discount is never more than the subtotal', () => {
  const lines = [{ unitPriceMinor: 1, quantity: 1 }, { unitPriceMinor: 3, quantity: 7 }];
  assert.doesNotThrow(() => calcOrder(lines, orderDiscountMinor(lines, 20)));
  assert.doesNotThrow(() => calcOrder(lines, orderDiscountMinor(lines, 100)));
});
test('receipt shows the promotion label from the saved order', () => {
  const order = { orderNo: 1, createdAt: new Date(), cashierName: 'A', status: 'COMPLETED', paymentStatus: 'PAID', subtotal: '1000.00', discount: '200.00', discountLabel: '20% OFF', total: '800.00', amountPaid: '800.00', items: [{ name: 'Mango', quantity: 1, unitPrice: '1000.00', lineTotal: '1000.00' }], payments: [{ amountReceived: '800.00', changeReturned: '0.00' }] };
  const r = buildReceipt(order, { businessName: 'X', currency: 'Rs' });
  assert.equal(r.discount, 'Rs 200');
  assert.equal(r.discountLabel, '20% OFF');
  assert.equal(r.total, 'Rs 800');
});
