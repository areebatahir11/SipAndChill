import test from 'node:test';
import assert from 'node:assert/strict';
import { canRetry, withRetry } from '../src/lib/db/retry.mjs';
import { prismaFailure } from '../src/lib/db/prisma-failure.mjs';

const noWait = { sleep: async () => {} };
const fail = (code, times, result = 'ok') => { let n = 0; return () => { if (n++ < times) throw Object.assign(new Error('x'), { code }); return result; }; };

test('P1001 is repeated for reads and writes; other connection errors only for reads', () => {
  assert.equal(canRetry({ code: 'P1001' }, 'create'), true);
  assert.equal(canRetry({ code: 'P1017' }, 'findMany'), true);
  assert.equal(canRetry({ code: 'P1017' }, 'update'), false);
  assert.equal(canRetry({ code: 'P2002' }, 'findMany'), false);
});
test('withRetry: succeeds after short failures, gives up after 3 tries, never repeats other errors', async () => {
  assert.equal(await withRetry(fail('P1001', 2), 'findUnique', noWait), 'ok');
  await assert.rejects(withRetry(fail('P1001', 3), 'findUnique', noWait), { code: 'P1001' });
  let calls = 0;
  await assert.rejects(withRetry(() => { calls++; throw Object.assign(new Error('dup'), { code: 'P2002' }); }, 'create', noWait));
  assert.equal(calls, 1);
});
test('unreachable database becomes a plain 503, not a generic 500', () => {
  assert.equal(prismaFailure({ code: 'P1001' }).status, 503);
});
