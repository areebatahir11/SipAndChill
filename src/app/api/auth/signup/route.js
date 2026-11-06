import { handle, ok, readJson, HttpError } from '@/lib/http';
import { assertSameOrigin } from '@/lib/auth/guard';
import { clientIp } from '@/lib/auth/client-ip';
import { allow } from '@/lib/rate-limit.mjs';
import { verifyTurnstile } from '@/lib/security/turnstile.mjs';
import { signupSchema } from '@/lib/validation/auth';
import { requestSignup } from '@/modules/auth/signup';

const LIMIT = { max: 10, windowMs: 60 * 60_000 }; // cheap first filter per instance; the database limits in requestSignup() are the ones that hold everywhere

/** Step 1 of signup: validates the form, checks the Turnstile CAPTCHA and emails a 6-digit code. The business is created only after /verify. */
export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const input = signupSchema.parse(await readJson(request));
  if (input.website) return ok({ verifyRequired: true, email: input.email }); // honeypot filled: pretend success, create nothing

  const ip = clientIp(request);
  if (!allow(`signup:${ip || 'unknown'}`, LIMIT)) throw new HttpError(429, 'Too many signups from this network. Please try again later.', 'RATE_LIMITED');

  const human = await verifyTurnstile(input.turnstileToken, { ip });
  if (!human.ok) {
    throw human.reason === 'UNAVAILABLE'
      ? new HttpError(503, 'We could not run the security check. Please try again in a moment.', 'CAPTCHA_UNAVAILABLE')
      : new HttpError(400, 'Please complete the security check and try again.', 'CAPTCHA_FAILED');
  }

  const { turnstileToken, website, ...form } = input;
  const { email } = await requestSignup(form, { ipAddress: ip });
  return ok({ verifyRequired: true, email });
});
