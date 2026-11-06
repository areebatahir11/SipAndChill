import { handle, ok, readJson, HttpError } from '@/lib/http';
import { assertSameOrigin } from '@/lib/auth/guard';
import { allow } from '@/lib/rate-limit.mjs';
import { loginSchema } from '@/lib/validation/auth';
import { login } from '@/modules/auth/service';

// Per-account lockout (5 wrong passwords = 15 minutes) already exists in login(). This adds a per-network cap so one
// address cannot try thousands of different accounts. 30 per 10 minutes is far above what a shop's staff ever need.
const IP_LIMIT = { max: 30, windowMs: 10 * 60_000 };

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const input = loginSchema.parse(await readJson(request));
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  if (!allow(`login:${ip ?? 'unknown'}`, IP_LIMIT)) {
    throw new HttpError(429, 'Too many sign-in attempts from this network. Please wait a few minutes and try again.', 'RATE_LIMITED');
  }
  const { redirectTo } = await login(input, { ipAddress: ip, userAgent: request.headers.get('user-agent') });
  return ok({ signedIn: true, redirectTo });
});
