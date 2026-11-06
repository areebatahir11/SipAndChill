import test from 'node:test';
import assert from 'node:assert/strict';
import { turnstileEnabled, verifyTurnstile } from '../src/lib/security/turnstile.mjs';

const reply = (json, ok = true) => async () => ({ ok, json: async () => json });

test('turnstile is off without a secret key: everything passes', async () => {
  assert.equal(turnstileEnabled(''), false);
  assert.equal(turnstileEnabled(undefined), false);
  assert.deepEqual(await verifyTurnstile(undefined, { secret: '' }), { ok: true });
});

test('with a secret key a missing token is refused and Cloudflare is not even called', async () => {
  let called = false;
  const r = await verifyTurnstile('', { secret: 's', fetchImpl: async () => { called = true; } });
  assert.deepEqual(r, { ok: false, reason: 'MISSING' });
  assert.equal(called, false);
});

test('Cloudflare success passes, failure is REJECTED, outage is UNAVAILABLE', async () => {
  assert.deepEqual(await verifyTurnstile('tok', { secret: 's', fetchImpl: reply({ success: true }) }), { ok: true });
  assert.deepEqual(await verifyTurnstile('tok', { secret: 's', fetchImpl: reply({ success: false, 'error-codes': ['timeout-or-duplicate'] }) }), { ok: false, reason: 'REJECTED' });
  assert.deepEqual(await verifyTurnstile('tok', { secret: 's', fetchImpl: reply({}, false) }), { ok: false, reason: 'UNAVAILABLE' });
  assert.deepEqual(await verifyTurnstile('tok', { secret: 's', fetchImpl: async () => { throw new Error('network'); } }), { ok: false, reason: 'UNAVAILABLE' });
});

test('the secret, token and caller IP are sent to Cloudflare', async () => {
  let sent;
  await verifyTurnstile('tok', { secret: 'sec', ip: '1.2.3.4', fetchImpl: async (url, init) => { sent = { url, body: init.body.toString() }; return { ok: true, json: async () => ({ success: true }) }; } });
  assert.match(sent.url, /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
  assert.match(sent.body, /secret=sec/); assert.match(sent.body, /response=tok/); assert.match(sent.body, /remoteip=1\.2\.3\.4/);
});
