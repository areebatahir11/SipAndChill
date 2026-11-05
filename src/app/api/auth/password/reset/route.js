import { handle, ok, readJson } from '@/lib/http';
import { assertSameOrigin } from '@/lib/auth/guard';
import { allow } from '@/lib/rate-limit.mjs';
import { passwordResetCompleteSchema } from '@/lib/validation/auth';
import { completePasswordReset } from '@/modules/auth/password-reset';
import { HttpError } from '@/lib/http';

const IP_LIMIT = { max: 20, windowMs: 60 * 60_000 };

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const input = passwordResetCompleteSchema.parse(await readJson(request));
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allow(`password-reset-verify:${ip}`, IP_LIMIT)) {
    throw new HttpError(429, 'Too many attempts. Please try again later.', 'RATE_LIMITED');
  }
  await completePasswordReset(input);
  return ok({ reset: true });
});
