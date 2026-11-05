import test from 'node:test';
import assert from 'node:assert/strict';
import { OTP_COOLDOWN_MS, OTP_MAX_PER_HOUR, canIssueOtp } from '../src/lib/auth/otp-policy.mjs';

const now = Date.parse('2026-11-05T10:00:00Z');
const ago = (ms) => new Date(now - ms);

test('first code is always allowed', () => assert.deepEqual(canIssueOtp([], now), { ok: true }));
test('a second code within the cooldown is refused, after it is allowed', () => {
  assert.deepEqual(canIssueOtp([ago(10_000)], now), { ok: false, reason: 'COOLDOWN' });
  assert.deepEqual(canIssueOtp([ago(OTP_COOLDOWN_MS + 1)], now), { ok: true });
});
test('after the hourly maximum no more codes are issued, even when the cooldown has passed', () => {
  const five = Array.from({ length: OTP_MAX_PER_HOUR }, (_, i) => ago(2 * 60_000 + i * 5 * 60_000));
  assert.deepEqual(canIssueOtp(five, now), { ok: false, reason: 'HOURLY_LIMIT' });
});
test('codes older than an hour no longer count', () => {
  const old = Array.from({ length: 9 }, () => ago(61 * 60_000));
  assert.deepEqual(canIssueOtp(old, now), { ok: true });
});
test('garbage dates are ignored instead of blocking everyone', () => {
  assert.deepEqual(canIssueOtp(['not a date', null], now), { ok: true });
});
