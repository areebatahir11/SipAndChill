import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIGNUP_COOLDOWN_MS, SIGNUP_MAX_SENDS_PER_HOUR, SIGNUP_MODES, canSendSignupCode, getSignupMode, nextSendState,
} from '../src/lib/auth/signup-policy.mjs';
import { TERMS_VERSION, TERMS_SECTIONS, termsRequired } from '../src/lib/legal/terms.mjs';

const now = Date.parse('2026-11-06T10:00:00Z');
const ago = (ms) => new Date(now - ms);

test('getSignupMode: defaults to approval, accepts the three modes, forgives spelling of separators', () => {
  assert.equal(getSignupMode(undefined), SIGNUP_MODES.APPROVAL);
  assert.equal(getSignupMode(''), SIGNUP_MODES.APPROVAL);
  assert.equal(getSignupMode('nonsense'), SIGNUP_MODES.APPROVAL);
  assert.equal(getSignupMode('open'), SIGNUP_MODES.OPEN);
  assert.equal(getSignupMode(' OPEN '), SIGNUP_MODES.OPEN);
  assert.equal(getSignupMode('invite_only'), SIGNUP_MODES.INVITE_ONLY);
  assert.equal(getSignupMode('invite-only'), SIGNUP_MODES.INVITE_ONLY);
});

test('canSendSignupCode: first code is allowed; second inside the cooldown is not', () => {
  assert.deepEqual(canSendSignupCode(null, now), { ok: true });
  const fresh = { lastSentAt: ago(10_000), windowStartedAt: ago(10_000), sendCount: 1 };
  assert.deepEqual(canSendSignupCode(fresh, now), { ok: false, reason: 'COOLDOWN' });
  assert.deepEqual(canSendSignupCode({ ...fresh, lastSentAt: ago(SIGNUP_COOLDOWN_MS + 1) }, now), { ok: true });
});

test('canSendSignupCode: hourly maximum blocks even after the cooldown, and the window resets after an hour', () => {
  const full = { lastSentAt: ago(5 * 60_000), windowStartedAt: ago(30 * 60_000), sendCount: SIGNUP_MAX_SENDS_PER_HOUR };
  assert.deepEqual(canSendSignupCode(full, now), { ok: false, reason: 'HOURLY_LIMIT' });
  assert.deepEqual(canSendSignupCode({ ...full, windowStartedAt: ago(61 * 60_000) }, now), { ok: true });
});

test('nextSendState: counts inside the window, restarts after it', () => {
  const first = nextSendState(null, now);
  assert.equal(first.sendCount, 1);
  assert.equal(first.windowStartedAt.getTime(), now);
  const second = nextSendState({ sendCount: 2, windowStartedAt: ago(20 * 60_000), lastSentAt: ago(20 * 60_000) }, now);
  assert.equal(second.sendCount, 3);
  assert.equal(second.windowStartedAt.getTime(), now - 20 * 60_000);
  const restarted = nextSendState({ sendCount: 5, windowStartedAt: ago(2 * 60 * 60_000), lastSentAt: ago(2 * 60 * 60_000) }, now);
  assert.equal(restarted.sendCount, 1);
});

test('termsRequired: only the Business Owner, only until the current version is accepted', () => {
  assert.equal(termsRequired({ roleCode: 'OWNER', acceptedVersions: [] }), true);
  assert.equal(termsRequired({ roleCode: 'OWNER', acceptedVersions: ['2020-01-01'] }), true); // an older version does not count
  assert.equal(termsRequired({ roleCode: 'OWNER', acceptedVersions: [TERMS_VERSION] }), false);
  assert.equal(termsRequired({ roleCode: 'MANAGER', acceptedVersions: [] }), false);
  assert.equal(termsRequired({ roleCode: 'CASHIER' }), false);
});

test('terms text is present and has a version', () => {
  assert.match(TERMS_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(TERMS_SECTIONS.length >= 8);
  assert.ok(TERMS_SECTIONS.every((s) => s.heading && s.body.length > 0));
});
