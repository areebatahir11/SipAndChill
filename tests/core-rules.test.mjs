// Run with:  npm test   (node --test, no extra dependencies)
// Covers the pure business rules (money, payments, permissions, dates, recipes, receipts) and the hardening
// added before launch. Rules that need the database (transactions, tenant isolation) still need a staging run.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { toMinor, fromMinor, calcOrder, calcPayment, paymentStatus, MAX_MINOR, decimalPlaces } from '../src/lib/money.mjs';
import { PERMISSIONS as P, PERMISSION_CATALOG, ROLE_DEFAULTS, ROLE_CODES, canManageRank, hasPermission, homeFor } from '../src/lib/permissions/codes.mjs';
import { resolveRange, bucketFor } from '../src/lib/orders/dates.mjs';
import { consumption, maxServings, mergeLines, toMilli, fromMilli } from '../src/lib/orders/recipe.mjs';
import { allow, resetRateLimits } from '../src/lib/rate-limit.mjs';
import { canIssueOtp } from '../src/lib/auth/otp-policy.mjs';
import { prismaFailure } from '../src/lib/db/prisma-failure.mjs';
import { assertLogo, detectLogoType, LOGO_MAX_BYTES } from '../src/lib/branding/logo.mjs';
import { buildReceipt } from '../src/lib/orders/receipt.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- money
test('toMinor accepts plain amounts and rejects everything else', () => {
  assert.equal(toMinor('850'), 85000);
  assert.equal(toMinor('12.5'), 1250);
  assert.equal(toMinor(0), 0);
  for (const bad of ['12.345', '-5', '1e3', '', 'abc', '1,000', ' ', null, undefined, NaN, '12.', '.5', '99999999999']) {
    assert.throws(() => toMinor(bad), RangeError, `should reject ${String(bad)}`);
  }
});

test('integer paisa avoids floating-point drift', () => {
  assert.notEqual(0.1 + 0.2, 0.3); // the trap
  const calc = calcOrder([{ unitPriceMinor: toMinor('19.99'), quantity: 3 }, { unitPriceMinor: toMinor('0.10'), quantity: 3 }]);
  assert.equal(fromMinor(calc.subtotalMinor), '60.27');
  assert.equal(fromMinor(calc.totalMinor), '60.27');
});

test('order total = sum(unit price x quantity); discount cannot exceed subtotal', () => {
  const calc = calcOrder([{ unitPriceMinor: 35000, quantity: 2 }, { unitPriceMinor: 15000, quantity: 1 }]);
  assert.deepEqual([calc.subtotalMinor, calc.totalMinor], [85000, 85000]);
  assert.throws(() => calcOrder([{ unitPriceMinor: 100, quantity: 1 }], 101), RangeError);
  assert.throws(() => calcOrder([{ unitPriceMinor: 100, quantity: 0 }]), RangeError);
  assert.throws(() => calcOrder([{ unitPriceMinor: 100, quantity: 1.5 }]), RangeError);
});

test('payments: exact, excess (change), partial (outstanding), nothing', () => {
  const exact = calcPayment(85000, 0, 85000);
  assert.deepEqual([exact.status, exact.changeMinor, exact.outstandingMinor], ['PAID', 0, 0]);

  const excess = calcPayment(85000, 0, 100000); // Rs 850 due, Rs 1,000 given
  assert.deepEqual([excess.status, excess.appliedMinor, excess.changeMinor, excess.paidMinor], ['PAID', 85000, 15000, 85000]);

  const partial = calcPayment(85000, 0, 50000);
  assert.deepEqual([partial.status, partial.changeMinor, partial.outstandingMinor, partial.paidMinor], ['PARTIAL', 0, 35000, 50000]);

  const none = calcPayment(85000, 0, 0);
  assert.deepEqual([none.status, none.outstandingMinor], ['UNPAID', 85000]);
});

test('a later payment settles the balance; change is never negative and never counted as revenue', () => {
  const second = calcPayment(85000, 50000, 40000); // Rs 350 still owed, customer gives Rs 400
  assert.deepEqual([second.status, second.appliedMinor, second.changeMinor, second.paidMinor], ['PAID', 35000, 5000, 85000]);
  for (const [t, a, r] of [[100, 0, 0], [100, 100, 50], [0, 0, 10]]) {
    const p = calcPayment(t, a, r);
    assert.ok(p.changeMinor >= 0 && p.outstandingMinor >= 0 && p.paidMinor <= Math.max(t, a));
  }
  assert.equal(paymentStatus(100, 0), 'UNPAID');
  assert.equal(paymentStatus(100, 99), 'PARTIAL');
  assert.equal(paymentStatus(100, 100), 'PAID');
});

test('MAX_MINOR matches DECIMAL(12,2) and an absurd order really exceeds it (why the server guard exists)', () => {
  assert.equal(fromMinor(MAX_MINOR), '9999999999.99');
  // The validators allow a unit price up to 9,999,999, quantity up to 999 and 60 lines.
  const worst = calcOrder(Array.from({ length: 60 }, () => ({ unitPriceMinor: 9_999_999 * 100, quantity: 999 })));
  assert.ok(worst.totalMinor > MAX_MINOR);
  assert.ok(Number.isSafeInteger(worst.totalMinor)); // still exact, so the guard can compare it reliably
});

test('decimalPlaces: validators use it to refuse values the database would silently round', () => {
  assert.equal(decimalPlaces(12), 0);
  assert.equal(decimalPlaces(12.5), 1);
  assert.equal(decimalPlaces(0.15), 2);
  assert.equal(decimalPlaces(0.001), 3);
  assert.ok(decimalPlaces(12.345) > 2);
  assert.ok(decimalPlaces(0.0004) > 3);
  assert.equal(decimalPlaces(1e-7), Infinity);
  assert.equal(decimalPlaces(9999999.123), 3);
});

// ---------------------------------------------------------------- permissions
test('every permission used by a role exists in the catalog (no typos)', () => {
  const known = new Set(PERMISSION_CATALOG.map((p) => p.code));
  assert.equal(known.size, Object.keys(P).length);
  for (const [role, def] of Object.entries(ROLE_DEFAULTS)) for (const c of def.permissions) assert.ok(known.has(c), `${role} -> ${c}`);
});

test('cashier: sells and prints, nothing administrative or financial', () => {
  const held = ROLE_DEFAULTS[ROLE_CODES.CASHIER].permissions;
  for (const c of [P.ORDERS_CREATE, P.ORDERS_VIEW, P.PAYMENTS_RECORD, P.RECEIPTS_PRINT]) assert.ok(held.includes(c), c);
  for (const c of [P.USERS_MANAGE, P.USERS_VIEW, P.SETTINGS_MANAGE, P.INVENTORY_ADJUST, P.INGREDIENTS_MANAGE, P.PRODUCTS_MANAGE, P.REPORTS_VIEW, P.DASHBOARD_VIEW, P.ORDERS_CANCEL, P.AUDIT_VIEW]) assert.ok(!held.includes(c), c);
});

test('inventory staff: stock only, no sales or money', () => {
  const held = ROLE_DEFAULTS[ROLE_CODES.INVENTORY_STAFF].permissions;
  for (const c of [P.INGREDIENTS_MANAGE, P.INVENTORY_ADJUST, P.INVENTORY_VIEW]) assert.ok(held.includes(c), c);
  for (const c of [P.ORDERS_CREATE, P.ORDERS_VIEW, P.PAYMENTS_RECORD, P.REPORTS_VIEW, P.DASHBOARD_VIEW, P.USERS_MANAGE, P.SETTINGS_MANAGE, P.ORDERS_CANCEL]) assert.ok(!held.includes(c), c);
});

test('manager cannot change settings or read the audit log; owner has everything', () => {
  const mgr = ROLE_DEFAULTS[ROLE_CODES.MANAGER].permissions;
  assert.ok(!mgr.includes(P.SETTINGS_MANAGE) && !mgr.includes(P.AUDIT_VIEW) && mgr.includes(P.USERS_MANAGE));
  assert.equal(ROLE_DEFAULTS[ROLE_CODES.OWNER].permissions.length, Object.keys(P).length);
});

test('hierarchy: you manage only ranks below yours', () => {
  const r = (c) => ROLE_DEFAULTS[c].rank;
  assert.ok(canManageRank(r('OWNER'), r('MANAGER')));
  assert.ok(canManageRank(r('MANAGER'), r('CASHIER')));
  assert.ok(!canManageRank(r('MANAGER'), r('MANAGER')));
  assert.ok(!canManageRank(r('MANAGER'), r('OWNER')));
  assert.ok(!canManageRank(r('CASHIER'), r('INVENTORY_STAFF')));
  assert.ok(!canManageRank(r('OWNER'), r('OWNER'))); // owners are created only by PearlSolutions
});

test('hasPermission: any-of semantics and empty requirement', () => {
  assert.ok(hasPermission([], undefined));
  assert.ok(hasPermission([], []));
  assert.ok(hasPermission([P.INVENTORY_VIEW], [P.INGREDIENTS_VIEW, P.INVENTORY_VIEW]));
  assert.ok(!hasPermission([P.ORDERS_VIEW], P.ORDERS_CANCEL));
});

test('each role lands on a page it may open', () => {
  assert.equal(homeFor(ROLE_DEFAULTS.CASHIER.permissions), '/pos');
  assert.equal(homeFor(ROLE_DEFAULTS.INVENTORY_STAFF.permissions), '/ingredients');
  assert.equal(homeFor(ROLE_DEFAULTS.OWNER.permissions), '/');
  assert.equal(homeFor([]), '/account');
});

// ---------------------------------------------------------------- dashboard date ranges (business day = Pakistan time)
test('date ranges: Pakistan midnight boundaries and previous-period comparison', () => {
  const now = new Date('2026-11-06T10:00:00Z'); // 15:00 on 6 Nov in Pakistan
  const today = resolveRange('today', {}, now);
  assert.equal(today.start.toISOString(), '2026-11-05T19:00:00.000Z');
  assert.equal(today.end.toISOString(), '2026-11-06T19:00:00.000Z');
  assert.equal(today.days, 1);
  assert.equal(today.prevEnd.getTime(), today.start.getTime());

  // 01:00 on 6 Nov in Pakistan is still 5 Nov in UTC: must count as the 6th.
  const late = resolveRange('today', {}, new Date('2026-11-05T20:00:00Z'));
  assert.equal(late.start.toISOString(), '2026-11-05T19:00:00.000Z');

  const yest = resolveRange('yesterday', {}, now);
  assert.equal(yest.end.getTime(), today.start.getTime());
  assert.equal(resolveRange('last7', {}, now).days, 7);
  assert.equal(resolveRange('last30', {}, now).days, 30);
  assert.equal(resolveRange('thisMonth', {}, now).start.toISOString(), '2026-10-31T19:00:00.000Z');
  const prev = resolveRange('prevMonth', {}, now);
  assert.equal(prev.start.toISOString(), '2026-09-30T19:00:00.000Z');
  assert.equal(prev.end.toISOString(), '2026-10-31T19:00:00.000Z');
  assert.equal(resolveRange('nonsense', {}, now).preset, 'today'); // unknown preset falls back safely
});

test('custom range is inclusive and rejects bad input', () => {
  const now = new Date('2026-11-06T10:00:00Z');
  const r = resolveRange('custom', { from: '2026-11-01', to: '2026-11-03' }, now);
  assert.equal(r.days, 3);
  for (const bad of [{ from: '2026-02-31', to: '2026-03-01' }, { from: '2026-11-05', to: '2026-11-01' }, { from: 'x', to: 'y' }, {}, { from: '2020-01-01', to: '2026-11-01' }]) {
    assert.throws(() => resolveRange('custom', bad, now), RangeError);
  }
  assert.deepEqual([1, 7, 36, 141].map(bucketFor), ['hour', 'day', 'week', 'month']);
});

// ---------------------------------------------------------------- recipes and stock
test('recipe consumption adds up across products and stays exact in milli-units', () => {
  assert.equal(toMilli('0.150'), 150);
  assert.equal(fromMilli(150), '0.150');
  const recipes = new Map([
    ['mango', [{ ingredientId: 'pulp', quantityMilli: 150_000 }, { ingredientId: 'milk', quantityMilli: 200_000 }, { ingredientId: 'sugar', quantityMilli: 20_000 }]],
    ['lemonade', [{ ingredientId: 'sugar', quantityMilli: 30_000 }]],
  ]);
  const need = consumption([{ productId: 'mango', quantity: 3 }, { productId: 'lemonade', quantity: 2 }, { productId: 'water', quantity: 5 }], recipes);
  assert.equal(need.get('pulp'), 450_000);
  assert.equal(need.get('milk'), 600_000);
  assert.equal(need.get('sugar'), 120_000); // 3 x 20 + 2 x 30
  assert.equal(need.size, 3); // a product without a recipe consumes nothing
});

test('maxServings is limited by the scarcest ingredient; no recipe means unlimited', () => {
  const recipe = [{ ingredientId: 'pulp', quantityMilli: 150_000 }, { ingredientId: 'milk', quantityMilli: 200_000 }];
  assert.equal(maxServings(recipe, new Map([['pulp', 1_000_000], ['milk', 500_000]])), 2);
  assert.equal(maxServings(recipe, new Map([['pulp', 1_000_000]])), 0);
  assert.equal(maxServings([], new Map()), null);
});

test('duplicate cart lines are merged', () => {
  assert.deepEqual(mergeLines([{ productId: 'a', quantity: 1 }, { productId: 'b', quantity: 2 }, { productId: 'a', quantity: 3 }]), [{ productId: 'a', quantity: 4 }, { productId: 'b', quantity: 2 }]);
});

// ---------------------------------------------------------------- receipts
test('receipt shows cash received, change and the outstanding balance of a partly paid order', () => {
  const order = {
    orderNo: 42, createdAt: '2026-11-06T10:00:00Z', cashierName: 'Ali', status: 'COMPLETED', paymentStatus: 'PARTIAL',
    subtotal: '850.00', discount: '0.00', total: '850.00', amountPaid: '500.00',
    items: [{ name: 'Mango Shake', quantity: 2, unitPrice: '350.00', lineTotal: '700.00' }, { name: 'Lemonade', quantity: 1, unitPrice: '150.00', lineTotal: '150.00' }],
    payments: [{ amountReceived: '500.00', changeReturned: '0.00' }],
  };
  const r = buildReceipt(order, { businessName: 'Sip & Chill', currency: 'Rs', receiptFooter: 'Thank you!' });
  assert.equal(r.total, 'Rs 850');
  assert.equal(r.received, 'Rs 500');
  assert.equal(r.outstanding, 'Rs 350');
  assert.equal(r.hasOutstanding, true);
  assert.equal(r.change, 'Rs 0');
  assert.equal(r.discount, null);

  const paid = buildReceipt({ ...order, paymentStatus: 'PAID', amountPaid: '850.00', payments: [{ amountReceived: '1000.00', changeReturned: '150.00' }] }, { businessName: 'x', currency: 'Rs' });
  assert.deepEqual([paid.received, paid.change, paid.hasOutstanding], ['Rs 1,000', 'Rs 150', false]);
});

// ---------------------------------------------------------------- abuse protection
test('rate limiter blocks after max hits and recovers when the window passes', () => {
  resetRateLimits();
  const rule = { max: 3, windowMs: 1000 };
  const t0 = 1_000_000;
  assert.deepEqual([0, 1, 2, 3].map((i) => allow('k', rule, t0 + i)), [true, true, true, false]);
  assert.equal(allow('other', rule, t0), true); // keys are independent
  assert.equal(allow('k', rule, t0 + 1500), true); // window passed
  resetRateLimits();
});

test('password-recovery codes: 60 s cooldown and 5 per hour', () => {
  const now = Date.now();
  assert.deepEqual(canIssueOtp([], now), { ok: true });
  assert.deepEqual(canIssueOtp([new Date(now - 30_000)], now), { ok: false, reason: 'COOLDOWN' });
  assert.deepEqual(canIssueOtp([new Date(now - 90_000)], now), { ok: true });
  const five = [1, 2, 3, 4, 5].map((i) => new Date(now - i * 600_000 + 1000));
  assert.deepEqual(canIssueOtp(five, now), { ok: false, reason: 'HOURLY_LIMIT' });
});

// ---------------------------------------------------------------- exception handling (new)
test('database errors a user can trigger become clear 4xx answers, never leaking internals', () => {
  assert.equal(prismaFailure({ code: 'P2020' }).status, 400);
  assert.equal(prismaFailure({ code: 'P2000' }).status, 400);
  assert.equal(prismaFailure({ name: 'PrismaClientValidationError', message: 'Unable to fit integer value ...' }).status, 400);
  assert.equal(prismaFailure({ code: 'P2025' }).status, 404);
  assert.equal(prismaFailure({ code: 'P2002' }).status, 409);
  assert.equal(prismaFailure({ code: 'P2003' }).status, 409);
  assert.equal(prismaFailure(new Error('connection refused')), null); // real outages stay a logged 500
  assert.equal(prismaFailure(null), null);
  const leaked = JSON.stringify(prismaFailure({ name: 'PrismaClientValidationError', message: 'SELECT secret FROM "User"' }));
  assert.ok(!leaked.includes('SELECT') && !leaked.includes('User'));
});

// ---------------------------------------------------------------- logo upload rules + shipped brand files
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
test('logo upload accepts PNG/JPG/WebP by file signature and refuses SVG, GIF, empty and oversize files', () => {
  assert.equal(assertLogo(png), 'image/png');
  assert.equal(detectLogoType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(detectLogoType(Buffer.from('RIFF0000WEBPVP8 ')), 'image/webp');
  assert.throws(() => assertLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), /PNG, JPG or WebP/);
  assert.throws(() => assertLogo(Buffer.from('GIF89a......')), /PNG, JPG or WebP/);
  assert.throws(() => assertLogo(Buffer.alloc(0)), /Choose a logo/);
  assert.throws(() => assertLogo(Buffer.concat([png, Buffer.alloc(LOGO_MAX_BYTES)])), /too big/);
  assert.throws(() => assertLogo(Buffer.from('not an image at all')), /PNG, JPG or WebP/); // a renamed .txt
});

test('PearlSolutions brand files exist, are real PNGs with transparency, and the icons are in place', () => {
  for (const f of ['public/brand/pearl-logo-dark.png', 'public/brand/pearl-logo-light.png', 'public/brand/pearl-mark.png', 'src/app/icon.png', 'src/app/apple-icon.png']) {
    const b = fs.readFileSync(path.join(ROOT, f));
    assert.equal(detectLogoType(b), 'image/png', f);
  }
  for (const f of ['public/brand/pearl-logo-dark.png', 'public/brand/pearl-logo-light.png', 'public/brand/pearl-mark.png']) {
    const b = fs.readFileSync(path.join(ROOT, f));
    assert.equal(b[25], 6, `${f} must be RGBA (colour type 6) so the background is transparent`);
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'src/app/favicon.ico')));
});

// ---------------------------------------------------------------- configuration guards
test('security headers are configured and keep the receipt printer (WebUSB / Web Serial) allowed', async () => {
  const cfg = (await import('../next.config.mjs')).default;
  const [{ headers }] = await cfg.headers();
  const get = (k) => headers.find((h) => h.key === k)?.value;
  assert.equal(get('X-Content-Type-Options'), 'nosniff');
  assert.equal(get('X-Frame-Options'), 'SAMEORIGIN');
  assert.ok(get('Referrer-Policy'));
  assert.match(get('Permissions-Policy'), /usb=\(self\)/);
  assert.match(get('Permissions-Policy'), /serial=\(self\)/);
  assert.equal(cfg.poweredByHeader, false);
});

test('.env.example carries placeholders only (no real host, project id or password hint)', () => {
  const text = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.ok(!/supabase\.com|pooler|ewvqtenxqyacqwbsagam|Startup@/i.test(text));
  assert.ok(!/@gmail\.com/i.test(text));
});

test('every API route is wrapped in handle() and guarded (public routes are explicitly listed)', () => {
  const PUBLIC = new Set(['auth/login', 'auth/logout', 'auth/signup', 'auth/password/forgot', 'auth/password/reset']);
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name === 'route.js' ? [path.join(dir, e.name)] : []));
  const base = path.join(ROOT, 'src/app/api');
  const routes = walk(base);
  assert.ok(routes.length > 30);
  for (const file of routes) {
    const rel = path.relative(base, path.dirname(file)).split(path.sep).join('/');
    const src = fs.readFileSync(file, 'utf8');
    // Check EACH exported handler separately: a file with a guarded GET and an unguarded POST must fail.
    const blocks = src.split(/(?=export const (?:GET|POST|PATCH|PUT|DELETE)\s*=)/).filter((b) => /^export const (GET|POST|PATCH|PUT|DELETE)/.test(b));
    assert.ok(blocks.length, rel);
    for (const block of blocks) {
      const [, method, wrapper] = /^export const (\w+)\s*=\s*(\w+)/.exec(block);
      assert.equal(wrapper, 'handle', `${rel} ${method} must use handle()`);
      if (PUBLIC.has(rel)) {
        assert.ok(/assertSameOrigin/.test(block), `${rel} ${method} must check the origin`);
      } else {
        assert.ok(/require(Api|PlatformApi)\(/.test(block), `${rel} ${method} must call requireApi/requirePlatformApi`);
      }
    }
  }
});
