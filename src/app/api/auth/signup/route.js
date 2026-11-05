import { handle, ok, readJson, HttpError } from '@/lib/http';
import { assertSameOrigin } from '@/lib/auth/guard';
import { allow } from '@/lib/rate-limit.mjs';
import { signupSchema } from '@/lib/validation/auth';
import { signup } from '@/modules/auth/service';

const LIMIT = { max: 5, windowMs: 60 * 60_000 }; // 5 signups per IP per hour

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const input = signupSchema.parse(await readJson(request));
  if (input.website) return ok({ signedIn: true, redirectTo: '/' }); // honeypot filled: pretend success, create nothing

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allow(`signup:${ip}`, LIMIT)) throw new HttpError(429, 'Too many signups from this network. Please try again later.', 'RATE_LIMITED');

  const { redirectTo } = await signup(input, { ipAddress: ip === 'unknown' ? null : ip, userAgent: request.headers.get('user-agent') });
  return ok({ signedIn: true, redirectTo }, { status: 201 });
});
