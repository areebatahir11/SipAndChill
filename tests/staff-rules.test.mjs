import test from 'node:test';
import assert from 'node:assert/strict';

// The staff validation uses the "@/..." import alias, which plain node cannot resolve, so check the rule it relies on.
import { ROLE_DEFAULTS, ROLE_CODES, canManageRank } from '../src/lib/permissions/codes.mjs';

test('an owner can hand out manager, cashier and inventory roles but never the owner role', () => {
  const ownerRank = ROLE_DEFAULTS[ROLE_CODES.OWNER].rank;
  const assignable = Object.entries(ROLE_DEFAULTS).filter(([, r]) => canManageRank(ownerRank, r.rank)).map(([c]) => c).sort();
  assert.deepEqual(assignable, [ROLE_CODES.CASHIER, ROLE_CODES.INVENTORY_STAFF, ROLE_CODES.MANAGER].sort());
});

test('a manager can hand out only the staff roles', () => {
  const rank = ROLE_DEFAULTS[ROLE_CODES.MANAGER].rank;
  const assignable = Object.entries(ROLE_DEFAULTS).filter(([, r]) => canManageRank(rank, r.rank)).map(([c]) => c).sort();
  assert.deepEqual(assignable, [ROLE_CODES.CASHIER, ROLE_CODES.INVENTORY_STAFF].sort());
});
