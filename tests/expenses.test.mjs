// Expenses + purchase rules. Pure logic, no database: run with `npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_CATEGORIES, STOCK_PURCHASE_CATEGORY, businessDateBounds, dateProblem, decimalToMinor, leftAfterSpending,
  lineTotalMinor, minorToNumber, parseAmountMinor, purchaseTotals, voidProblem,
} from '../src/lib/expenses.mjs';
import { PAYMENT_METHODS } from '../src/lib/payments.mjs';
import { resolveRange } from '../src/lib/orders/dates.mjs';
import { PERMISSIONS as P, PERMISSION_CATALOG, ROLE_CODES, ROLE_DEFAULTS, ROUTE_ACCESS, hasPermission, homeFor } from '../src/lib/permissions/codes.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('amounts: only positive money with at most 2 decimals is accepted', () => {
  assert.equal(parseAmountMinor('1500'), 150000);
  assert.equal(parseAmountMinor(12.5), 1250);
  assert.equal(parseAmountMinor('0.01'), 1);
  for (const bad of ['0', 0, '-5', '12.345', '', 'abc', null, undefined, '1e3', '99999999999']) assert.equal(parseAmountMinor(bad), null, `should reject ${bad}`);
});

test('purchase line = quantity x unit cost, rounded to the nearest paisa', () => {
  assert.equal(lineTotalMinor(2.5, '120.50'), 30125);
  assert.equal(lineTotalMinor(0.333, 99.99), 3330);
  assert.equal(lineTotalMinor(10, 180), 180000);
  assert.equal(lineTotalMinor(1, 0), 0);
  assert.equal(lineTotalMinor(0.001, 0.5), 0); // half a paisa x 0.001 rounds away
  assert.throws(() => lineTotalMinor(0, 10), RangeError);
  assert.throws(() => lineTotalMinor(-1, 10), RangeError);
  assert.throws(() => lineTotalMinor(1, 1.234), RangeError); // more than 2 decimals in a price
});

test('purchase line stays exact for very large quantities (no float drift)', () => {

  assert.equal(lineTotalMinor(1_000_000, 9999.99), 999999000000);
  assert.throws(() => lineTotalMinor(9_999_999, 9_999_999), /too large/);
});

test('purchase total is the exact sum of its lines', () => {
  const t = purchaseTotals([{ quantity: 10, unitCost: 180 }, { quantity: 0.333, unitCost: 99.99 }, { quantity: 3, unitCost: 0.1 }]);
  assert.deepEqual(t.lines.map((l) => l.lineMinor), [180000, 3330, 30]);
  assert.equal(t.totalMinor, 183360); // 0.1 x 3 would be 0.30000000000000004 in floats
});

test('received minus spent is exact and may be negative', () => {
  assert.equal(leftAfterSpending(150000, 40000), 110000);
  assert.equal(leftAfterSpending(10000, 25050), -15050);
  assert.equal(decimalToMinor('1234.50'), 123450);
  assert.equal(decimalToMinor(null), 0);
  assert.equal(minorToNumber(123450), 1234.5);
  assert.equal(minorToNumber(-15050), -150.5);
});

test('expense dates use the same range presets as the dashboard (Pakistan business day)', () => {
  const now = new Date('2026-11-17T10:00:00Z'); // 15:00 in Karachi
  assert.deepEqual(businessDateBounds(resolveRange('today', {}, now)), { from: '2026-11-17', to: '2026-11-17' });
  assert.deepEqual(businessDateBounds(resolveRange('yesterday', {}, now)), { from: '2026-11-16', to: '2026-11-16' });
  assert.deepEqual(businessDateBounds(resolveRange('last7', {}, now)), { from: '2026-11-11', to: '2026-11-17' });
  assert.deepEqual(businessDateBounds(resolveRange('prevMonth', {}, now)), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(businessDateBounds(resolveRange('custom', { from: '2026-11-01', to: '2026-11-05' }, now)), { from: '2026-11-01', to: '2026-11-05' });
  // 23:30 UTC on the 17th is already the 18th in Karachi
  assert.deepEqual(businessDateBounds(resolveRange('today', {}, new Date('2026-11-17T23:30:00Z'))), { from: '2026-11-18', to: '2026-11-18' });
});

test('an expense date cannot be in the future or more than a year back', () => {
  assert.equal(dateProblem('2026-11-17', '2026-11-17'), null);
  assert.equal(dateProblem('2026-11-01', '2026-11-17'), null);
  assert.match(dateProblem('2026-11-18', '2026-11-17'), /future/);
  assert.match(dateProblem('2025-01-01', '2026-11-17'), /year/);
});

test('only active, hand-typed expenses can be voided', () => {
  assert.equal(voidProblem({ source: 'MANUAL', voidedAt: null }), null);
  assert.match(voidProblem({ source: 'MANUAL', voidedAt: new Date() }), /already voided/);
  assert.match(voidProblem({ source: 'STOCK_PURCHASE', voidedAt: null }), /Stock page/);
});

test('default categories: unique, with the app-owned Stock Purchase first', () => {
  assert.equal(DEFAULT_CATEGORIES[0], STOCK_PURCHASE_CATEGORY);
  assert.equal(new Set(DEFAULT_CATEGORIES).size, DEFAULT_CATEGORIES.length);
  for (const n of ['Rent', 'Salaries', 'Electricity & Gas', 'Other']) assert.ok(DEFAULT_CATEGORIES.includes(n));
});

test('permissions: owner and manager see expenses; cashier and inventory staff do not', () => {
  const held = (code) => ROLE_DEFAULTS[code].permissions;
  for (const role of [ROLE_CODES.OWNER, ROLE_CODES.MANAGER]) {
    assert.ok(held(role).includes(P.EXPENSES_VIEW) && held(role).includes(P.EXPENSES_MANAGE), role);
  }
  for (const role of [ROLE_CODES.CASHIER, ROLE_CODES.INVENTORY_STAFF]) {
    assert.ok(!held(role).includes(P.EXPENSES_VIEW) && !held(role).includes(P.EXPENSES_MANAGE), role);
  }
  // inventory staff can still receive stock (and so record a purchase) without seeing any financial page
  assert.ok(held(ROLE_CODES.INVENTORY_STAFF).includes(P.INVENTORY_ADJUST));
});

test('permission catalog and navigation include Expenses exactly once', () => {
  const codes = PERMISSION_CATALOG.map((p) => p.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.includes('expenses.view') && codes.includes('expenses.manage'));
  const routes = ROUTE_ACCESS.filter((r) => r.href === '/expenses');
  assert.equal(routes.length, 1);
  assert.deepEqual(routes[0].any, [P.EXPENSES_VIEW]);
  assert.equal(hasPermission([P.ORDERS_CREATE], routes[0].any), false);
  assert.equal(homeFor([P.ORDERS_CREATE, P.ORDERS_VIEW]), '/pos'); // cashier landing is unchanged
});

test('API routes are guarded with the right permission', () => {
  const need = (file, ...codes) => { const src = read(file); for (const c of codes) assert.ok(src.includes(`requireApi(request, P.${c})`), `${file} must require ${c}`); };
  need('src/app/api/expenses/route.js', 'EXPENSES_VIEW', 'EXPENSES_MANAGE');
  need('src/app/api/expenses/[id]/void/route.js', 'EXPENSES_MANAGE');
  need('src/app/api/expense-categories/route.js', 'EXPENSES_VIEW', 'EXPENSES_MANAGE');
  need('src/app/api/expense-categories/[id]/route.js', 'EXPENSES_MANAGE');
  need('src/app/api/purchases/route.js', 'INVENTORY_ADJUST');
});

test('every expense query is scoped to the signed-in tenant', () => {
  const src = read('src/modules/expenses/service.js');
  for (const call of src.match(/prisma\.(expense|expenseCategory|supplier)\.(findFirst|updateMany|findMany|count|groupBy|aggregate)\(\{[^]*?\}\)/g) ?? []) {
    assert.ok(call.includes('tenantId') || call.includes('where,') || call.includes('where }') || call.includes('where: { ...where'), `unscoped query: ${call.slice(0, 80)}`);
  }
  assert.ok(/updateMany\(\{ where: \{ id, tenantId: auth\.tenantId, voidedAt: null \}/.test(src), 'void must be a tenant-scoped conditional update');
});

test('purchases save stock, movements and the expense in ONE transaction', () => {
  const src = read('src/modules/inventory/service.js');
  const buy = src.slice(src.indexOf('export async function recordPurchase'));
  assert.ok(buy.includes('prisma.$transaction'));
  assert.ok(buy.indexOf('tx.expense.create') < buy.indexOf('tx.stockMovement.create'));
  assert.ok(buy.includes('expenseId: created.id'));
  assert.ok(buy.includes('stock: item.stock'), 'optimistic stock check');
});

test('migration matches the app: methods, sources, positive amounts, void rule', () => {
  const sql = read('prisma/migrations/20261117100000_expenses/migration.sql');
  for (const m of PAYMENT_METHODS) assert.ok(sql.includes(`'${m}'`), m);
  assert.ok(sql.includes(`"amount" > 0`));
  assert.ok(sql.includes(`'MANUAL', 'STOCK_PURCHASE'`));
  assert.ok(sql.includes('"voidedAt" IS NULL) = ("voidReason" IS NULL'));
  assert.ok(sql.includes('DECIMAL(12,2)'));
  const schema = read('prisma/schema.prisma');
  assert.ok(/model Expense \{/.test(schema) && /model ExpenseCategory \{/.test(schema) && /expenseId\s+String\?/.test(schema));
});
