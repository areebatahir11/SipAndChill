import test from 'node:test';
import assert from 'node:assert/strict';
import { PERMISSIONS, PERMISSION_CATALOG, ROLE_DEFAULTS, ROLE_CODES, ROUTE_ACCESS, OWNER_RANK, canManageRank, hasPermission, homeFor } from '../src/lib/permissions/codes.mjs';

const P = PERMISSIONS;
const perms = (role) => ROLE_DEFAULTS[role].permissions;

test('catalog covers every permission code exactly once', () => {
  const codes = PERMISSION_CATALOG.map((p) => p.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.deepEqual([...codes].sort(), Object.values(P).sort());
});

test('every role only references known permissions', () => {
  for (const role of Object.values(ROLE_DEFAULTS)) for (const c of role.permissions) assert.ok(Object.values(P).includes(c), c);
});

test('owner holds every permission', () => {
  assert.equal(perms(ROLE_CODES.OWNER).length, Object.values(P).length);
});

test('cashier can sell but cannot manage staff, stock, menu or see financial reports', () => {
  const c = perms(ROLE_CODES.CASHIER);
  for (const ok of [P.ORDERS_CREATE, P.PAYMENTS_RECORD, P.RECEIPTS_PRINT]) assert.ok(c.includes(ok), ok);
  for (const no of [P.USERS_MANAGE, P.USERS_VIEW, P.INVENTORY_ADJUST, P.INGREDIENTS_MANAGE, P.PRODUCTS_MANAGE, P.DASHBOARD_VIEW, P.REPORTS_VIEW, P.ORDERS_CANCEL, P.SETTINGS_MANAGE]) assert.ok(!c.includes(no), no);
});

test('inventory staff manage stock but have no admin or financial access', () => {
  const i = perms(ROLE_CODES.INVENTORY_STAFF);
  for (const ok of [P.INGREDIENTS_MANAGE, P.INVENTORY_ADJUST, P.SUPPLIERS_MANAGE]) assert.ok(i.includes(ok), ok);
  for (const no of [P.USERS_MANAGE, P.DASHBOARD_VIEW, P.REPORTS_VIEW, P.ORDERS_CREATE, P.PAYMENTS_RECORD, P.PRODUCTS_MANAGE]) assert.ok(!i.includes(no), no);
});

test('hasPermission: single, any-of, and empty requirement', () => {
  assert.equal(hasPermission([P.ORDERS_VIEW], P.ORDERS_VIEW), true);
  assert.equal(hasPermission([P.ORDERS_VIEW], P.ORDERS_CREATE), false);
  assert.equal(hasPermission([P.ORDERS_VIEW], [P.ORDERS_CREATE, P.ORDERS_VIEW]), true);
  assert.equal(hasPermission([], [P.ORDERS_CREATE, P.ORDERS_VIEW]), false);
  assert.equal(hasPermission([], undefined), true);
});

test('manager runs operations but cannot touch settings or audit log', () => {
  const m = perms(ROLE_CODES.MANAGER);
  for (const ok of [P.DASHBOARD_VIEW, P.REPORTS_VIEW, P.USERS_MANAGE, P.PRODUCTS_MANAGE, P.INVENTORY_ADJUST, P.ORDERS_CANCEL]) assert.ok(m.includes(ok), ok);
  for (const no of [P.SETTINGS_MANAGE, P.AUDIT_VIEW]) assert.ok(!m.includes(no), no);
});

test('ranks form a hierarchy: owner > manager > cashier = inventory staff', () => {
  const r = (c) => ROLE_DEFAULTS[c].rank;
  assert.equal(r(ROLE_CODES.OWNER), OWNER_RANK);
  assert.ok(r(ROLE_CODES.OWNER) > r(ROLE_CODES.MANAGER));
  assert.ok(r(ROLE_CODES.MANAGER) > r(ROLE_CODES.CASHIER));
  assert.equal(r(ROLE_CODES.CASHIER), r(ROLE_CODES.INVENTORY_STAFF));
});

test('canManageRank: flow moves downward only; nobody manages their own level, so an owner never adds another owner', () => {
  const r = (c) => ROLE_DEFAULTS[c].rank;
  assert.equal(canManageRank(r(ROLE_CODES.OWNER), r(ROLE_CODES.MANAGER)), true);
  assert.equal(canManageRank(r(ROLE_CODES.OWNER), r(ROLE_CODES.OWNER)), false);
  assert.equal(canManageRank(r(ROLE_CODES.MANAGER), r(ROLE_CODES.CASHIER)), true);
  assert.equal(canManageRank(r(ROLE_CODES.MANAGER), r(ROLE_CODES.MANAGER)), false); // peers
  assert.equal(canManageRank(r(ROLE_CODES.MANAGER), r(ROLE_CODES.OWNER)), false);   // no escalation
  assert.equal(canManageRank(r(ROLE_CODES.CASHIER), r(ROLE_CODES.CASHIER)), false);
  assert.equal(canManageRank(r(ROLE_CODES.CASHIER), r(ROLE_CODES.INVENTORY_STAFF)), false);
});

test('landing page is always a finished page the role may open, else /account', () => {
  assert.equal(homeFor(perms(ROLE_CODES.OWNER)), '/');
  assert.equal(homeFor(perms(ROLE_CODES.MANAGER)), '/');
  assert.equal(homeFor(perms(ROLE_CODES.CASHIER)), '/pos'); // cashier lands straight on the counter
  assert.equal(homeFor(perms(ROLE_CODES.INVENTORY_STAFF)), '/ingredients');
  assert.equal(homeFor([]), '/account');
  for (const role of Object.keys(ROLE_DEFAULTS)) {
    const home = homeFor(perms(role));
    const route = ROUTE_ACCESS.find((x) => x.href === home);
    assert.ok(home === '/account' || hasPermission(perms(role), route.any));
  }
});

test('inventory: only owner, manager and inventory staff can adjust stock; cashier cannot even view it', () => {
  for (const role of [ROLE_CODES.OWNER, ROLE_CODES.MANAGER, ROLE_CODES.INVENTORY_STAFF]) {
    assert.ok(perms(role).includes(P.INVENTORY_ADJUST), role);
    assert.ok(perms(role).includes(P.SUPPLIERS_MANAGE), role);
  }
  for (const no of [P.INGREDIENTS_VIEW, P.INVENTORY_VIEW, P.INVENTORY_ADJUST, P.SUPPLIERS_VIEW]) assert.ok(!perms(ROLE_CODES.CASHIER).includes(no), no);
});

test('menu: only owner and manager manage menu and recipes; inventory staff may view recipes but not edit; cashier sees no recipes', () => {
  for (const role of [ROLE_CODES.OWNER, ROLE_CODES.MANAGER]) for (const c of [P.PRODUCTS_MANAGE, P.CATEGORIES_MANAGE, P.RECIPES_MANAGE]) assert.ok(perms(role).includes(c), `${role} ${c}`);
  assert.ok(perms(ROLE_CODES.INVENTORY_STAFF).includes(P.RECIPES_VIEW));
  for (const no of [P.PRODUCTS_MANAGE, P.RECIPES_MANAGE]) assert.ok(!perms(ROLE_CODES.INVENTORY_STAFF).includes(no), no);
  for (const no of [P.RECIPES_VIEW, P.RECIPES_MANAGE, P.PRODUCTS_MANAGE]) assert.ok(!perms(ROLE_CODES.CASHIER).includes(no), no);
});

test('POS and order routes: cashier sees counter + orders; inventory staff see neither', () => {
  const can = (role, href) => hasPermission(perms(role), ROUTE_ACCESS.find((r) => r.href === href).any);
  assert.ok(can(ROLE_CODES.CASHIER, '/pos') && can(ROLE_CODES.CASHIER, '/orders'));
  assert.ok(!can(ROLE_CODES.CASHIER, '/') && !can(ROLE_CODES.CASHIER, '/staff'));
  assert.ok(!can(ROLE_CODES.INVENTORY_STAFF, '/pos') && !can(ROLE_CODES.INVENTORY_STAFF, '/orders') && !can(ROLE_CODES.INVENTORY_STAFF, '/'));
});

test('cancelling orders and viewing reports is manager-level; cashier cannot cancel', () => {
  assert.ok(!perms(ROLE_CODES.CASHIER).includes(P.ORDERS_CANCEL));
  for (const role of [ROLE_CODES.OWNER, ROLE_CODES.MANAGER]) assert.ok(perms(role).includes(P.ORDERS_CANCEL) && perms(role).includes(P.REPORTS_VIEW));
});

test('every sidebar entry has a plain label and hint', () => {
  for (const r of ROUTE_ACCESS) assert.ok(r.label && r.hint, r.href);
});

test('printer setup is not a sidebar heading (it opens from the Printer button), but the /printer page keeps its permission', () => {
  const printer = ROUTE_ACCESS.find((r) => r.href === '/printer');
  assert.equal(printer.menu, false);
  assert.deepEqual(printer.any, [P.RECEIPTS_PRINT]);
  assert.ok(ROUTE_ACCESS.filter((r) => r.menu !== false).every((r) => r.href !== '/printer'));
});
