// Rules for how often a password-recovery code may be issued. Pure functions, covered by tests/otp-policy.test.mjs.
// They are checked against the database (not server memory), so they hold on serverless hosting too, where every
// request may run on a different instance and an in-memory counter would start from zero.

export const OTP_TTL_MS = 10 * 60_000;     // a code works for 10 minutes
export const MAX_OTP_ATTEMPTS = 5;         // wrong guesses allowed per code
export const OTP_COOLDOWN_MS = 60_000;     // at least 60 seconds between two codes
export const OTP_MAX_PER_HOUR = 5;         // at most 5 codes per account per hour
const HOUR_MS = 60 * 60_000;

/**
 * @param createdAts  creation times of the account's codes (any state) from the last hour
 * @returns { ok: true } or { ok: false, reason: 'COOLDOWN' | 'HOURLY_LIMIT' }
 *
 * Why it matters: a code has 1,000,000 possibilities and 5 guesses. Without a limit on NEW codes an attacker
 * could keep asking for fresh codes (and fill the owner's inbox). With 5 codes per hour that is at most 25
 * guesses per hour against one in a million.
 */
export function canIssueOtp(createdAts, now = Date.now()) {
  const times = createdAts.map((d) => new Date(d).getTime()).filter((t) => Number.isFinite(t) && now - t < HOUR_MS);
  if (times.length >= OTP_MAX_PER_HOUR) return { ok: false, reason: 'HOURLY_LIMIT' };
  if (times.length && now - Math.max(...times) < OTP_COOLDOWN_MS) return { ok: false, reason: 'COOLDOWN' };
  return { ok: true };
}
