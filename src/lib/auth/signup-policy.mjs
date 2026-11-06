// Rules for public signup. Pure functions (no framework or database code), covered by tests/signup-policy.test.mjs.

export const SIGNUP_MODES = Object.freeze({
  OPEN: 'open',               // verified email -> business is active at once and the owner is signed in
  APPROVAL: 'approval',       // verified email -> business waits as PENDING until PearlSolutions approves it
  INVITE_ONLY: 'invite_only', // public signup is closed; PearlSolutions adds clients itself
});

/** Reads SIGNUP_MODE. Anything missing or misspelled falls back to the safe middle option: approval. */
export function getSignupMode(value = process.env.SIGNUP_MODE) {
  const v = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return Object.values(SIGNUP_MODES).includes(v) ? v : SIGNUP_MODES.APPROVAL;
}

export const SIGNUP_OTP_TTL_MS = 10 * 60_000;   // the emailed code works for 10 minutes
export const MAX_SIGNUP_ATTEMPTS = 5;           // wrong guesses allowed per code
export const SIGNUP_COOLDOWN_MS = 60_000;       // at least 60 seconds between two codes to the same email
export const SIGNUP_MAX_SENDS_PER_HOUR = 5;     // at most 5 codes per email per hour
export const SIGNUP_MAX_REQUESTS_PER_IP_HOUR = 10; // at most 10 different emails started per network per hour
const HOUR_MS = 60 * 60_000;

const time = (d) => (d ? new Date(d).getTime() : NaN);

/**
 * existing: the stored request for this email ({ lastSentAt, windowStartedAt, sendCount }) or null.
 * Returns { ok: true } or { ok: false, reason: 'COOLDOWN' | 'HOURLY_LIMIT' }.
 */
export function canSendSignupCode(existing, now = Date.now()) {
  if (!existing) return { ok: true };
  const windowStart = time(existing.windowStartedAt);
  const inWindow = Number.isFinite(windowStart) && now - windowStart < HOUR_MS;
  if (inWindow && existing.sendCount >= SIGNUP_MAX_SENDS_PER_HOUR) return { ok: false, reason: 'HOURLY_LIMIT' };
  const last = time(existing.lastSentAt);
  if (Number.isFinite(last) && now - last < SIGNUP_COOLDOWN_MS) return { ok: false, reason: 'COOLDOWN' };
  return { ok: true };
}

/** The counters to store after sending a code now. Starts a fresh hour window when the old one has ended. */
export function nextSendState(existing, now = Date.now()) {
  const windowStart = time(existing?.windowStartedAt);
  const inWindow = existing && Number.isFinite(windowStart) && now - windowStart < HOUR_MS;
  return {
    sendCount: inWindow ? existing.sendCount + 1 : 1,
    windowStartedAt: new Date(inWindow ? windowStart : now),
    lastSentAt: new Date(now),
  };
}
