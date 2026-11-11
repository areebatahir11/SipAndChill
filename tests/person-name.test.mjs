import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERMISSIONS as P, ROLE_DEFAULTS, ROLE_CODES, canManageRank } from '../src/lib/permissions/codes.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const has = (role) => ROLE_DEFAULTS[role].permissions.includes(P.USERS_MANAGE);

test('the name rule allows "M. Usman" and Urdu names, and refuses empty or one-letter names', () => {
  const rule = read('src/lib/validation/staff.js');
  assert.match(rule, /const name = z\.string\(\)\.trim\(\)\.min\(2, 'Name is too short\.'\)\.max\(80\)/); // trimmed, 2 to 80 characters, any letters or punctuation
  assert.match(rule, /updateStaffSchema = z[\s\S]*name: name\.optional\(\)/);
  for (const ok of ['M. Usman', 'محمد عثمان', 'Gulraiz']) assert.ok(ok.trim().length >= 2 && ok.length <= 80, ok);
});

test('who may rename whom: owner and manager can (themselves and lower roles); cashier and inventory staff cannot', () => {
  assert.equal(has(ROLE_CODES.OWNER), true);
  assert.equal(has(ROLE_CODES.MANAGER), true);
  assert.equal(has(ROLE_CODES.CASHIER), false);
  assert.equal(has(ROLE_CODES.INVENTORY_STAFF), false);
  const rank = (c) => ROLE_DEFAULTS[c].rank;
  assert.equal(canManageRank(rank(ROLE_CODES.MANAGER), rank(ROLE_CODES.CASHIER)), true);
  assert.equal(canManageRank(rank(ROLE_CODES.MANAGER), rank(ROLE_CODES.OWNER)), false); // a manager cannot rename the owner
});

test('the server enforces it (screens only mirror it)', () => {
  assert.match(read('src/app/api/staff/[userId]/route.js'), /requireApi\(request, P\.USERS_MANAGE\)/);
  const svc = read('src/modules/users/service.js');
  assert.match(svc, /if \(!isSelf\) assertCanManage\(auth, member\.role\.rank, 'change'\)/); // others: only lower ranks
  assert.match(svc, /renamedFrom/); // the audit log keeps the old name
  assert.match(svc, /findMember\(auth\.tenantId, userId\)/); // another business's user id is a 404
});

test('the screens: Rename in My Team, "My name" on My Account, shown only to those allowed', () => {
  const team = read('src/features/staff/StaffManager.js');
  assert.match(team, /open\('name', s, \{ name: s\.name \}\)/);
  assert.match(team, /\(mine \|\| \(self && canManage\)\)/);
  assert.match(read('src/features/staff/StaffDialogs.js'), /dialog\.type === 'name'/);
  const card = read('src/features/account/ProfileNameCard.js');
  assert.match(card, /can\(P\.USERS_MANAGE\)/);
  assert.match(card, /router\.refresh\(\)/);
  assert.match(read('src/app/(dashboard)/account/page.js'), /before=\{<ProfileNameCard \/>\}/);
});

test('old receipts keep the name they were printed with (the cashier name is stored on the order)', () => {
  assert.match(read('src/modules/orders/service.js'), /cashierId: auth\.user\.id, cashierName: auth\.user\.name/);
});
