import test from 'node:test';
import assert from 'node:assert/strict';
import { maskReference, settlePayments } from '../src/lib/payments.mjs';
import { emptyPayForm, payloadOf, readPayForm } from '../src/lib/payment-form.mjs';
import { buildReceipt } from '../src/lib/orders/receipt.mjs';
import { receiptToEscPos } from '../src/lib/printing/escpos.mjs';

const rs = (n) => n * 100;
const online = (method, amount, reference = 'TX123456') => ({ method, amountMinor: rs(amount), reference });
const cash = (amount) => ({ method: 'CASH', amountMinor: rs(amount), reference: null });

// ---- settlePayments: the rules the server enforces ----
test('cash alone gives change and settles the order', () => {
  const r = settlePayments(rs(480), 0, [cash(500)]);
  assert.equal(r.status, 'PAID');
  assert.equal(r.changeMinor, rs(20));
  assert.equal(r.outstandingMinor, 0);
});

test('online money is exact: more than is due is refused (only cash gives change)', () => {
  assert.throws(() => settlePayments(rs(500), 0, [online('JAZZCASH', 600)]), /more than what is due/);
});

test('split payment: online first, cash settles the rest and gives the change', () => {
  const r = settlePayments(rs(1000), 0, [online('EASYPAISA', 400), cash(1000)]);
  assert.equal(r.status, 'PAID');
  assert.equal(r.onlineMinor, rs(400));
  assert.equal(r.cashAppliedMinor, rs(600));
  assert.equal(r.changeMinor, rs(400)); // cash 1000 handed, 600 needed
  assert.deepEqual(r.rows.map((x) => x.method), ['EASYPAISA', 'CASH']);
});

test('part payment online leaves the order partly paid', () => {
  const r = settlePayments(rs(1000), 0, [online('BANK_TRANSFER', 300)]);
  assert.equal(r.status, 'PARTIAL');
  assert.equal(r.outstandingMinor, rs(700));
});

test('the transaction ID is optional; when given it is 4-40 letters/numbers, spaces and case ignored', () => {
  assert.equal(settlePayments(rs(500), 0, [online('JAZZCASH', 500, '')]).rows[0].reference, null);
  assert.equal(settlePayments(rs(500), 0, [online('JAZZCASH', 500, null)]).status, 'PAID');
  assert.throws(() => settlePayments(rs(500), 0, [online('JAZZCASH', 500, 'AB1')]), /transaction ID/);
  const r = settlePayments(rs(500), 0, [online('JAZZCASH', 500, ' tx 12-34 ')]);
  assert.equal(r.rows[0].reference, 'TX12-34');
});

test('an unknown method or the same method twice is refused', () => {
  assert.throws(() => settlePayments(rs(500), 0, [{ method: 'BITCOIN', amountMinor: rs(500), reference: 'TX123456' }]), /how the customer paid/);
  assert.throws(() => settlePayments(rs(500), 0, [online('JAZZCASH', 200, 'AAAA1111'), online('JAZZCASH', 300, 'BBBB2222')]), /listed twice/);
});

test('cash is refused when online already covers everything', () => {
  assert.throws(() => settlePayments(rs(500), 0, [online('JAZZCASH', 500), cash(100)]), /Nothing is left to pay in cash/);
});

test('a later payment only counts what is still outstanding', () => {
  const r = settlePayments(rs(1000), rs(600), [online('EASYPAISA', 400)]);
  assert.equal(r.status, 'PAID');
  assert.throws(() => settlePayments(rs(1000), rs(600), [online('EASYPAISA', 500)]), /more than what is due/);
});

test('receipts show only the end of a transaction ID', () => {
  assert.equal(maskReference('TX123456789'), '••••6789');
  assert.equal(maskReference(null), '');
});

// ---- readPayForm: what the cashier typed -> rows ----
const formWith = (patch) => ({ ...emptyPayForm(), ...patch });
const method = (m, amount, reference) => ({ [m]: { on: true, amount, reference } });
const withMethods = (...parts) => ({ ...emptyPayForm().methods, ...Object.assign({}, ...parts) });

test('default form is cash only, nothing typed = no payment yet (order saved as unpaid)', () => {
  const r = readPayForm(emptyPayForm(), rs(500));
  assert.equal(r.error, '');
  assert.deepEqual(r.payments, []);
  assert.equal(r.pay.status, 'UNPAID');
});

test('cash typed gives change', () => {
  const r = readPayForm(formWith({ cashAmount: '1000' }), rs(750));
  assert.equal(r.pay.changeMinor, rs(250));
  assert.deepEqual(payloadOf(r.payments), [{ method: 'CASH', amount: '1000.00' }]);
});

test('one online method with no amount means the full amount', () => {
  const f = formWith({ cash: false, online: true, methods: withMethods(method('JAZZCASH', '', 'tx9988')) });
  const r = readPayForm(f, rs(640));
  assert.equal(r.error, '');
  assert.deepEqual(payloadOf(r.payments), [{ method: 'JAZZCASH', amount: '640.00', reference: 'TX9988' }]);
  assert.equal(r.pay.status, 'PAID');
});

test('online without a transaction ID is allowed and sends no ID', () => {
  const f = formWith({ cash: false, online: true, methods: withMethods(method('EASYPAISA', '', '')) });
  const r = readPayForm(f, rs(300));
  assert.equal(r.error, '');
  assert.deepEqual(payloadOf(r.payments), [{ method: 'EASYPAISA', amount: '300.00' }]);
});

test('a transaction ID that is too short is stopped before it is sent', () => {
  const f = formWith({ cash: false, online: true, methods: withMethods(method('EASYPAISA', '', 'ab')) });
  assert.match(readPayForm(f, rs(300)).error, /Easypaisa transaction ID must be 4 to 40/);
});

test('online turned on but no method chosen asks to choose one', () => {
  assert.match(readPayForm(formWith({ cash: false, online: true }), rs(300)).error, /Choose JazzCash, Easypaisa or Bank transfer/);
});

test('split: online amount is required once cash is also entered', () => {
  const f = formWith({ cashAmount: '500', online: true, methods: withMethods(method('BANK_TRANSFER', '', 'BANKREF1')) });
  assert.match(readPayForm(f, rs(900)).error, /Enter the Bank transfer amount/);
  const ok = readPayForm({ ...f, methods: withMethods(method('BANK_TRANSFER', '400', 'BANKREF1')) }, rs(900));
  assert.equal(ok.error, '');
  assert.equal(ok.pay.status, 'PAID');
  assert.deepEqual(payloadOf(ok.payments).map((p) => p.method), ['BANK_TRANSFER', 'CASH']);
});

test('a bad amount says so instead of crashing', () => {
  assert.match(readPayForm(formWith({ cashAmount: '12.345' }), rs(500)).error, /valid cash amount/);
});

// ---- receipt ----
const order = (payments) => ({
  orderNo: 7, createdAt: new Date('2026-11-11T09:00:00Z'), cashierName: 'Ali', status: 'COMPLETED',
  items: [{ name: 'Mango Shake', quantity: 2, unitPrice: '450.00', lineTotal: '900.00' }],
  subtotal: '900.00', discount: '0.00', total: '900.00', amountPaid: '900.00', paymentStatus: 'PAID', payments,
});
const settings = { businessName: 'Test Juice', currency: 'Rs' };

test('receipt lists each way of paying and masks the transaction ID', () => {
  const m = buildReceipt(order([
    { method: 'JAZZCASH', reference: 'TX123456789', amountReceived: '400.00', amountApplied: '400.00', changeReturned: '0.00' },
    { method: 'CASH', reference: null, amountReceived: '600.00', amountApplied: '500.00', changeReturned: '100.00' },
  ]), settings);
  assert.equal(m.hasOnline, true);
  assert.deepEqual(m.paymentLines.map((l) => [l.label, l.ref]), [['JazzCash', '••••6789'], ['Cash', null]]);
  assert.equal(m.hasChange, true);
  assert.ok(!JSON.stringify(m).includes('TX123456789'), 'the full ID must never reach the receipt');
});

test('a cash-only receipt keeps the old layout (no online lines)', () => {
  const m = buildReceipt(order([{ method: 'CASH', reference: null, amountReceived: '1000.00', amountApplied: '900.00', changeReturned: '100.00' }]), settings);
  assert.equal(m.hasOnline, false);
});

test('the printer receives the online lines too', () => {
  const m = buildReceipt(order([{ method: 'EASYPAISA', reference: 'EP55667788', amountReceived: '900.00', amountApplied: '900.00', changeReturned: '0.00' }]), settings);
  const bytes = Buffer.from(receiptToEscPos(m, { paper: 80 }).bytes).toString('latin1');
  assert.match(bytes, /Paid by Easypaisa/);
  assert.match(bytes, /7788/);
  assert.ok(!bytes.includes('EP55667788'));
});
