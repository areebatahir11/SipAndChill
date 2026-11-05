import { after } from 'next/server';
import { handle, ok, readJson, HttpError } from '@/lib/http';
import { assertSameOrigin } from '@/lib/auth/guard';
import { allow } from '@/lib/rate-limit.mjs';
import { passwordResetRequestSchema } from '@/lib/validation/auth';
import { GENERIC_REQUEST_MESSAGE, requestPasswordReset } from '@/modules/auth/password-reset';

const IP_LIMIT = { max: 10, windowMs: 60 * 60_000 };
const EMAIL_LIMIT = { max: 3, windowMs: 15 * 60_000 };

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const { email } = passwordResetRequestSchema.parse(await readJson(request));
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allow(`password-reset:ip:${ip}`, IP_LIMIT)) {
    throw new HttpError(429, 'Too many recovery requests. Please try again later.', 'RATE_LIMITED');
  }
  if (allow(`password-reset:email:${email}`, EMAIL_LIMIT)) {
    // The real work (database lookup, code hashing, sending the email) runs AFTER the response is sent. Otherwise an
    // eligible account would answer a few seconds slower than an unknown one, which reveals which emails exist.
    // The database-backed limits in requestPasswordReset() are the ones that hold on serverless hosting.
    after(async () => {
      try { await requestPasswordReset(email); } catch (error) { console.error('[password-reset] request failed:', error); }
    });
  }
  return ok({ message: GENERIC_REQUEST_MESSAGE });
});
