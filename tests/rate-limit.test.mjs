import test from 'node:test';
import assert from 'node:assert/strict';
import { allow, resetRateLimits } from '../src/lib/rate-limit.mjs';

const LIMIT = { max: 3, windowMs: 1000 };

test('allows up to max calls per window, then blocks', () => {
  resetRateLimits();
  assert.deepEqual([0, 1, 2, 3].map(() => allow('ip-1', LIMIT, 0)), [true, true, true, false]);
});

test('keys are independent and the window slides', () => {
  resetRateLimits();
  for (let i = 0; i < 3; i++) allow('a', LIMIT, 0);
  assert.equal(allow('a', LIMIT, 500), false);
  assert.equal(allow('b', LIMIT, 500), true);
  assert.equal(allow('a', LIMIT, 1001), true); // the earlier hits expired
});
