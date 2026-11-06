// Cloudflare Turnstile (free CAPTCHA). The browser shows a widget that produces a one-time token; the server checks that
// token with Cloudflare before doing anything expensive (sending email, creating rows). Plain ESM so it is unit-tested.
//
// Env: NEXT_PUBLIC_TURNSTILE_SITE_KEY (public, used by the widget) and TURNSTILE_SECRET_KEY (private, used here).
// When the secret key is not set the check is skipped, so the site keeps working before keys are configured.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const turnstileEnabled = (secret = process.env.TURNSTILE_SECRET_KEY) => Boolean(secret && secret.trim());

/**
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'MISSING' | 'REJECTED' | 'UNAVAILABLE' }>}
 * MISSING: no token sent. REJECTED: Cloudflare says it is invalid, expired or already used. UNAVAILABLE: Cloudflare could not be reached.
 */
export async function verifyTurnstile(token, { ip, secret = process.env.TURNSTILE_SECRET_KEY, fetchImpl = fetch } = {}) {
  if (!turnstileEnabled(secret)) return { ok: true };
  if (!token || typeof token !== 'string') return { ok: false, reason: 'MISSING' };
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetchImpl(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, reason: 'UNAVAILABLE' };
    const json = await res.json();
    return json.success === true ? { ok: true } : { ok: false, reason: 'REJECTED' };
  } catch {
    return { ok: false, reason: 'UNAVAILABLE' };
  }
}
