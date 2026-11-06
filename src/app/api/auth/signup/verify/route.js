import { after } from 'next/server';
import { handle, ok, readJson, HttpError } from '@/lib/http';
import { assertSameOrigin } from '@/lib/auth/guard';
import { clientIp } from '@/lib/auth/client-ip';
import { allow } from '@/lib/rate-limit.mjs';
import { TENANT_STATUS } from '@/lib/platform/constants.mjs';
import { signupVerifySchema } from '@/lib/validation/auth';
import { verifySignup } from '@/modules/auth/signup';
import { notifyAdminsOfSignup } from '@/modules/auth/signup-emails';

const LIMIT = { max: 20, windowMs: 60 * 60_000 };

/** Step 2 of signup: confirms the emailed code. Approval mode -> { status: 'PENDING' }; open mode -> signed in, { status: 'ACTIVE', redirectTo }. */
export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const input = signupVerifySchema.parse(await readJson(request));
  const ip = clientIp(request);
  if (!allow(`signup-verify:${ip || 'unknown'}`, LIMIT)) throw new HttpError(429, 'Too many attempts. Please try again later.', 'RATE_LIMITED');

  const result = await verifySignup(input, { ipAddress: ip, userAgent: request.headers.get('user-agent') });
  if (result.status === TENANT_STATUS.PENDING) after(() => notifyAdminsOfSignup(result)); // runs after the response, so the user is not kept waiting for email
  return ok({ status: result.status, redirectTo: result.redirectTo ?? null }, { status: 201 });
});
