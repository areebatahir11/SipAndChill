import test from 'node:test';
import assert from 'node:assert/strict';
import { purgeProblem, PURGE_CONFIRM_PHRASE } from './expenses.mjs';

test('an active (not voided) expense can never be purged', () => {
  assert.match(purgeProblem({ voidedAt: null, source: 'MANUAL' }), /voided/i);
});
test('a voided stock purchase cannot be purged', () => {
  assert.match(purgeProblem({ voidedAt: new Date(), source: 'STOCK_PURCHASE' }), /stock/i);
});
test('a voided manual expense can be purged', () => {
  assert.equal(purgeProblem({ voidedAt: new Date(), source: 'MANUAL' }), null);
});
test('the confirmation phrase is fixed', () => {
  assert.equal(PURGE_CONFIRM_PHRASE, 'PURGE');
});
