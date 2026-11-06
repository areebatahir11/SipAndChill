import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReceipt } from '../src/lib/orders/receipt.mjs';
import {
  COLS, EscPos, chunk, drawerOnly, formatDate, needsPicture, receiptToEscPos, receiptsPerRoll, testSlip, toAscii, wrap,
} from '../src/lib/printing/escpos.mjs';

const order = (over = {}) => ({
  orderNo: 42, createdAt: '2026-11-05T09:30:00.000Z', cashierName: 'Areeba', status: 'COMPLETED', paymentStatus: 'PAID',
  subtotal: '700.00', discount: '0.00', total: '700.00', amountPaid: '700.00',
  items: [
    { name: 'Cold Coffee', quantity: 2, unitPrice: '250.00', lineTotal: '500.00' },
    { name: 'Chocolate Shake with Extra Ice Cream and Brownie Chunks', quantity: 1, unitPrice: '200.00', lineTotal: '200.00' },
  ],
  payments: [{ amountReceived: '1000.00', changeReturned: '300.00' }],
  ...over,
});
const settings = { businessName: 'Sip & Chill', phone: '0300-1234567', address: 'Model Town, Lahore', receiptFooter: 'Thank you! Visit again.', currency: 'Rs' };
const model = (o) => buildReceipt(order(o), settings);
const asText = (bytes) => Buffer.from(bytes).toString('latin1');
const has = (bytes, seq) => Buffer.from(bytes).includes(Buffer.from(seq));

// ---------- text helpers ----------
test('wrap: breaks at spaces, cuts very long words, never returns nothing', () => {
  assert.deepEqual(wrap('hello big world', 9), ['hello big', 'world']);
  assert.deepEqual(wrap('abcdefghij', 4), ['abcd', 'efgh', 'ij']);
  assert.deepEqual(wrap('', 10), ['']);
  for (const l of wrap('Chocolate Shake with Extra Ice Cream and Brownie Chunks', 32)) assert.ok(l.length <= 32);
});
test('toAscii: smart quotes and dashes are mapped, other characters become ? and are reported', () => {
  assert.deepEqual(toAscii('It\u2019s \u2013 ok'), { text: "It's - ok", lossy: false });
  assert.deepEqual(toAscii('Chai \u0686\u0627\u0626\u06d2'), { text: 'Chai ????', lossy: true });
});
test('needsPicture is true only for text the printer cannot print', () => {
  assert.equal(needsPicture('Cold Coffee'), false);
  assert.equal(needsPicture('It\u2019s'), false);
  assert.equal(needsPicture('\u0686\u0627\u0626\u06d2'), true);
});
test('chunk splits without losing or reordering bytes', () => {
  const b = Uint8Array.from({ length: 10 }, (_, i) => i);
  const parts = chunk(b, 4);
  assert.deepEqual(parts.map((p) => p.length), [4, 4, 2]);
  assert.deepEqual(Uint8Array.from(parts.flatMap((p) => [...p])), b);
});

// ---------- commands ----------
test('init, alignment, bold, size, feed, cut and drawer use the standard ESC/POS bytes', () => {
  assert.deepEqual([...new EscPos().init().bytes()], [0x1b, 0x40, 0x1b, 0x74, 0x00]);
  assert.deepEqual([...new EscPos().align('center').bytes()], [0x1b, 0x61, 1]);
  assert.deepEqual([...new EscPos().bold(true).bytes()], [0x1b, 0x45, 1]);
  assert.deepEqual([...new EscPos().size(2, 2).bytes()], [0x1d, 0x21, 0x11]);
  assert.deepEqual([...new EscPos().size(9, 0).bytes()], [0x1d, 0x21, 0x10]); // clamped to 1..2
  assert.deepEqual([...new EscPos().feed(3).bytes()], [0x1b, 0x64, 3]);
  assert.deepEqual([...new EscPos().cut().bytes()], [0x1d, 0x56, 0x42, 0x00]);
  assert.deepEqual([...drawerOnly()].slice(-5), [0x1b, 0x70, 0x00, 0x32, 0xfa]);
});
test('row: right text is always whole and the line is exactly one line wide', () => {
  const p = new EscPos({ cols: 32 }).row('Cold Coffee with a very long name here', 'Rs 1,250');
  const text = asText(p.bytes());
  assert.equal(text.length, 33); // 32 characters + LF
  assert.ok(text.endsWith('Rs 1,250\n'));
  const q = new EscPos({ cols: 32 }).row('Total', 'Rs 5');
  assert.equal(asText(q.bytes()).replace('\n', '').length, 32);
});
test('picture command: GS v 0 with width in bytes and height', () => {
  const bytes = new EscPos().picture({ widthBytes: 48, height: 24, data: new Uint8Array(48 * 24) }).bytes();
  assert.deepEqual([...bytes].slice(0, 8), [0x1d, 0x76, 0x30, 0x00, 48, 0, 24, 0]);
  assert.equal(bytes.length, 8 + 48 * 24);
});

// ---------- full receipt ----------
test('receipt: every line fits the paper (32 / 48 characters) and the job ends with a cut', () => {
  for (const paper of [58, 80]) {
    const { bytes } = receiptToEscPos(model(), { paper });
    // strip control sequences, then check each printable line
    const plain = asText(bytes).replace(/\x1b[@]|\x1bt.|\x1ba.|\x1bE.|\x1bd.|\x1d!.|\x1dVB./g, '');
    for (const l of plain.split('\n')) assert.ok(l.length <= COLS[paper], `${paper}mm line too long: "${l}"`);
    assert.deepEqual([...bytes].slice(-4), [0x1d, 0x56, 0x42, 0x00]);
    assert.ok(has(bytes, 'Sip & Chill'));
    assert.ok(has(bytes, 'Order #'));
    assert.ok(has(bytes, 'Rs 700'));
    assert.ok(has(bytes, 'Rs 300'));            // change returned
    assert.ok(has(bytes, 'Thank you! Visit again.'));
  }
});
test('receipt: long item names wrap instead of being cut off', () => {
  const { bytes } = receiptToEscPos(model(), { paper: 58 });
  const text = asText(bytes);
  assert.ok(text.includes('Chocolate Shake with Extra Ice'));
  assert.ok(text.includes('Brownie Chunks'));
});
test('receipt: outstanding amount and partial status are printed; cancelled banner for cancelled orders', () => {
  const partial = receiptToEscPos(model({ paymentStatus: 'PARTIAL', amountPaid: '300.00', payments: [{ amountReceived: '300.00', changeReturned: '0.00' }] }), { paper: 80 }).bytes;
  assert.ok(has(partial, 'Outstanding'));
  assert.ok(has(partial, 'PARTIALLY PAID'));
  const cancelled = receiptToEscPos(model({ status: 'CANCELLED' }), { paper: 80 }).bytes;
  assert.ok(has(cancelled, '*** CANCELLED ***'));
  assert.ok(!has(cancelled, 'Outstanding'));
});
test('receipt: the date is printed in Pakistan time whatever time zone the PC uses', () => {
  assert.equal(formatDate('2026-11-05T09:30:00.000Z'), '05/11/2026 02:30 PM');
  assert.equal(formatDate('2026-11-05T19:05:00.000Z'), '06/11/2026 12:05 AM');
  assert.equal(formatDate('nonsense'), '');
});
test('copies: each copy is a whole slip with its own cut; the drawer opens once and only for paid sales', () => {
  const one = receiptToEscPos(model(), { paper: 80, drawer: true });
  const two = receiptToEscPos(model(), { paper: 80, drawer: true, copies: 2 });
  const cuts = (b) => asText(b).split('\x1dVB\x00').length - 1;
  const kicks = (b) => asText(b).split('\x1bp\x00\x32\xfa').length - 1;
  assert.equal(cuts(one.bytes), 1);
  assert.equal(cuts(two.bytes), 2);
  assert.equal(kicks(two.bytes), 1);
  assert.equal(kicks(receiptToEscPos(model({ paymentStatus: 'UNPAID', amountPaid: '0.00', payments: [] }), { paper: 80, drawer: true }).bytes), 0);
  assert.equal(receiptToEscPos(model(), { copies: 99 }).copies, 5); // sane upper limit
  assert.equal(cuts(receiptToEscPos(model(), { cut: false }).bytes), 0);
});
test('non-Latin names: printed as a picture when a rasterizer exists, "?" when it does not', () => {
  const urdu = model({ items: [{ name: '\u0686\u0627\u0626\u06d2', quantity: 1, unitPrice: '100.00', lineTotal: '100.00' }] });
  const calls = [];
  const withPic = receiptToEscPos(urdu, { paper: 58, picture: (text, o) => { calls.push([text, o.dots]); return { widthBytes: 48, height: 24, data: new Uint8Array(48 * 24) }; } });
  assert.deepEqual(calls, [['\u0686\u0627\u0626\u06d2', 384]]);
  assert.ok(has(withPic.bytes, [0x1d, 0x76, 0x30, 0x00]));
  const without = receiptToEscPos(urdu, { paper: 58 });
  assert.ok(has(without.bytes, '????'));
  assert.ok(!has(without.bytes, [0x1d, 0x76, 0x30, 0x00]));
});

// ---------- paper usage ----------
test('paper estimate: length grows with items and roll capacity is derived from it', () => {
  const small = receiptToEscPos(model({ items: [order().items[0]] }), { paper: 80 });
  const big = receiptToEscPos(model({ items: Array.from({ length: 12 }, () => order().items[0]) }), { paper: 80 });
  assert.ok(big.lengthMm > small.lengthMm);
  assert.ok(small.lengthMm > 40 && small.lengthMm < 200, String(small.lengthMm));
  assert.equal(receiptsPerRoll(100, 80), 700);   // 70 m roll / 10 cm
  assert.equal(receiptsPerRoll(100, 58), 300);   // 30 m roll / 10 cm
  assert.equal(receiptsPerRoll(0, 80), 0);
});
test('test slip is a complete job', () => {
  const t = testSlip({ paper: 58 });
  assert.ok(has(t.bytes, 'PRINTER OK'));
  assert.deepEqual([...t.bytes].slice(-4), [0x1d, 0x56, 0x42, 0x00]);
});

test('cut styles: standard feeds+cuts by itself, older printers get 6 lines of feed and GS V 1 / GS V 0', () => {
  const model = buildReceipt(order(), settings);
  const tail = (r, n) => [...r.bytes.slice(-n)];
  assert.deepEqual(tail(receiptToEscPos(model, { paper: 80 }), 4), [0x1d, 0x56, 0x42, 0x00]);               // default = unchanged
  assert.deepEqual(tail(receiptToEscPos(model, { paper: 80, cutStyle: 'partial' }), 3), [0x1d, 0x56, 0x01]);
  assert.deepEqual(tail(receiptToEscPos(model, { paper: 80, cutStyle: 'full' }), 3), [0x1d, 0x56, 0x00]);
  assert.deepEqual(tail(receiptToEscPos(model, { paper: 80, cutStyle: 'nonsense' }), 4), [0x1d, 0x56, 0x42, 0x00]); // unknown -> standard
  const feedOf = (r) => { const b = [...r.bytes]; const i = b.lastIndexOf(0x64); return b[i + 1]; };           // last ESC d n before the cut
  assert.equal(feedOf(receiptToEscPos(model, { paper: 80 })), 4);
  assert.equal(feedOf(receiptToEscPos(model, { paper: 80, cutStyle: 'partial' })), 6);
  assert.deepEqual([...testSlip({ paper: 80, cutStyle: 'full' }).bytes.slice(-3)], [0x1d, 0x56, 0x00]);
  assert.equal([...receiptToEscPos(model, { paper: 80, cut: false }).bytes].join(',').includes('29,86'), false);       // cut off = no cut command
});
