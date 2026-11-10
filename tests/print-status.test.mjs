import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ATTENTION_GRACE_MS, needsAttention, nextPrintState, PRINT_EVENTS, PRINT_LABEL, PRINT_STATUS } from '../src/lib/orders/print-status.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const NOW = new Date('2026-11-07T10:00:00Z');

// ---------------------------------------------------------------- status rules
test('direct print accepted by the printer is SENT (not "confirmed"), and needs no attention', () => {
  const s = nextPrintState({ printStatus: 'NOT_REQUESTED', printAttempts: 0 }, 'sent', NOW);
  assert.equal(s.printStatus, PRINT_STATUS.SENT);
  assert.equal(s.printAttempts, 1);
  assert.equal(s.printConfirmedAt, undefined);
  assert.ok(!needsAttention(s.printStatus));
});

test('a failed print is a PROBLEM that needs attention; a later successful retry clears it', () => {
  const failed = nextPrintState({ printStatus: 'NOT_REQUESTED', printAttempts: 0 }, 'failed', NOW);
  assert.equal(failed.printStatus, PRINT_STATUS.PROBLEM);
  assert.ok(needsAttention(failed.printStatus));
  const retried = nextPrintState({ printStatus: 'PROBLEM', printAttempts: 0 }, 'sent', NOW);
  assert.equal(retried.printStatus, PRINT_STATUS.SENT);
  assert.ok(!needsAttention(retried.printStatus));
});

test('a receipt that already went out stays fine when a reprint fails or a print window is opened', () => {
  for (const good of ['SENT', 'CONFIRMED']) {
    assert.equal(nextPrintState({ printStatus: good, printAttempts: 1 }, 'failed', NOW).printStatus, good);
    assert.equal(nextPrintState({ printStatus: good, printAttempts: 1 }, 'opened', NOW).printStatus, good);
  }
  assert.equal(nextPrintState({ printStatus: 'CONFIRMED', printAttempts: 1 }, 'sent', NOW).printStatus, 'CONFIRMED');
});

test('browser print window: only "check paper" until someone confirms', () => {
  const s = nextPrintState({ printStatus: 'NOT_REQUESTED', printAttempts: 0 }, 'opened', NOW);
  assert.equal(s.printStatus, PRINT_STATUS.DIALOG_OPENED);
  assert.ok(needsAttention(s.printStatus));
  const c = nextPrintState({ printStatus: 'DIALOG_OPENED', printAttempts: 1 }, 'confirmed', NOW);
  assert.equal(c.printStatus, PRINT_STATUS.CONFIRMED);
  assert.equal(c.printConfirmedAt, NOW);
});

test('a print event can only ever change the print columns (never totals, payments, stock)', () => {
  const ALLOWED = new Set(['printStatus', 'printAttempts', 'lastPrintAt', 'printConfirmedAt']);
  for (const status of Object.values(PRINT_STATUS)) {
    for (const event of PRINT_EVENTS) {
      for (const key of Object.keys(nextPrintState({ printStatus: status, printAttempts: 2 }, event, NOW))) assert.ok(ALLOWED.has(key), `${status}/${event} -> ${key}`);
    }
  }
  assert.throws(() => nextPrintState({}, 'delete-everything'), RangeError);
});

test('every status has a label, and the grace period is short but not zero', () => {
  for (const status of Object.values(PRINT_STATUS)) assert.equal(PRINT_LABEL[status].length, 3, status);
  assert.ok(ATTENTION_GRACE_MS >= 60_000 && ATTENTION_GRACE_MS <= 10 * 60_000);
});

// ---------------------------------------------------------------- server guards (no database needed)
test('the print service is tenant-scoped and writes only print columns', () => {
  const src = read('src/modules/orders/service.js');
  const body = src.slice(src.indexOf('export async function recordPrintEvent'), src.indexOf('// Later payment'));
  assert.match(body, /const where = \{ id, \.\.\.scope\(auth\) \}/, 'same tenant/cashier scope as viewing an order');
  for (const forbidden of ['payment.', 'stockMovement', 'ingredient', 'amountPaid', 'total:', "status: 'CANCELLED'"]) assert.ok(!body.includes(forbidden), `print code must not touch ${forbidden}`);
  assert.match(body.slice(body.indexOf('export async function listPrintAttention')), /\.\.\.scope\(auth\)/, 'the banner list must be tenant scoped too');
});

test('the print API only accepts an event name and needs the receipts.print permission', () => {
  assert.match(read('src/app/api/orders/[id]/print/route.js'), /RECEIPTS_PRINT/);
  assert.match(read('src/app/api/orders/[id]/print/route.js'), /printEventSchema\.parse/);
  assert.match(read('src/lib/validation/orders.js'), /printEventSchema = z\.object\(\{\s*event: z\.enum\(\['sent', 'opened', 'confirmed', 'failed'\]\),\s*\}\)/);
  assert.match(read('src/app/api/orders/print-attention/route.js'), /RECEIPTS_PRINT/);
});

test('schema keeps the newest columns (discountLabel) AND has the print columns, so Prisma sees no drift', () => {
  const schema = read('prisma/schema.prisma');
  for (const f of ['discountLabel', 'printStatus', 'printAttempts', 'lastPrintAt', 'printConfirmedAt']) assert.ok(schema.includes(f), f);
  const dirs = fs.readdirSync(path.join(ROOT, 'prisma/migrations'));
  assert.ok(dirs.includes('20261106150000_order_discount_label') && dirs.includes('20261107100000_order_print_status'));
});

test('migration is additive with safe defaults (old code keeps working while it is applied first)', () => {
  const dir = fs.readdirSync(path.join(ROOT, 'prisma/migrations')).find((d) => d.endsWith('order_print_status'));
  const sql = read(`prisma/migrations/${dir}/migration.sql`);
  assert.match(sql, /ADD COLUMN "printStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED'/);
  assert.match(sql, /ADD COLUMN "printAttempts" INTEGER NOT NULL DEFAULT 0/);
  assert.ok(!/DROP|RENAME|ALTER COLUMN/i.test(sql.replace(/--.*$/gm, '')), 'no destructive statements');
  for (const f of ['printStatus', 'printAttempts', 'lastPrintAt', 'printConfirmedAt']) assert.ok(read('prisma/schema.prisma').includes(f), f);
});

// ---------------------------------------------------------------- the live setup must NOT change
test('REGRESSION: direct USB / serial printing, Zadig help and auto-print after each sale are all still there', () => {
  const printer = read('src/features/printing/printer.js');
  assert.match(printer, /navigator\.usb\.requestDevice/);
  assert.match(printer, /navigator\.serial\.requestPort/);
  assert.match(printer, /transferOut/);
  assert.match(read('src/features/printing/PrinterSetup.js'), /Zadig/);
  const pos = read('src/features/pos/PosCounter.js');
  assert.match(pos, /live\.autoPrint[^\n]*printerState\.api\.printOrder\(order\.id\)/, 'auto-print after Confirm order must stay');
  assert.match(read('next.config.mjs'), /usb=\(self\), serial=\(self\)/);
  assert.match(read('src/features/printing/printer.js'), /autoPrint: true/);
});

test('direct printing reports its result to the order (sent / failed) and a failed receipt load is no longer silent', () => {
  const printer = read('src/features/printing/printer.js');
  assert.match(printer, /reportPrint\(orderId, 'sent'\)/);
  assert.match(printer, /reportPrint\(orderId, 'failed'\)/);
  const loadFailure = printer.slice(printer.indexOf('export async function printOrder'));
  assert.match(loadFailure, /setStatus\('error'/);
  assert.match(loadFailure, /printModel\(data\.model, data\.paper, orderId\)/);
  assert.match(read('src/features/receipt/PrintControls.js'), /printModel\(model, width, orderId\)/);
});

test('failure UI: banner on the counter and orders pages, per-button failure, error-aware printer button', () => {
  assert.match(read('src/features/pos/PosCounter.js'), /<PrintAttentionBanner \/>/);
  assert.match(read('src/features/orders/OrdersView.js'), /<PrintAttentionBanner \/>/); // shared by /orders (today) and /orders/history
  const btn = read('src/features/printing/PrintReceiptButton.js');
  assert.match(btn, /triedAt/, 'only the pressed button shows its failure');
  assert.match(btn, /Open receipt page/);
  assert.match(btn, /Retry print/);
  const status = read('src/features/printing/PrinterStatusButton.js');
  assert.match(status, /Print failed/);
});

test('orders list: status pill, "Print problems" filter, direct Reprint button on every row', () => {
  const table = read('src/features/orders/OrdersTable.js');
  assert.match(table, /<PrintReceiptButton orderId=\{o\.id\}/);
  assert.match(table, /<PrintStatusPill/);
  assert.match(read('src/features/orders/OrdersView.js'), /\['print', 'Print problems'\]/);
  assert.match(read('src/lib/validation/orders.js'), /'cancelled', 'print'/);
});
